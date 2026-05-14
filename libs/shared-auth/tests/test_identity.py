import asyncio

import jwt
import pytest
from fastapi import HTTPException
from starlette.requests import Request

from shared_auth.identity import _extract_identity, require_proxy_user, require_user, resolve_token, warn_if_jwks_unconfigured


def _jwt(payload: dict) -> str:
    return jwt.encode(payload, key="dev-secret-with-at-least-32-bytes", algorithm="HS256")


def _request(headers: dict[str, str]) -> Request:
    return Request({"type": "http", "headers": [(k.lower().encode(), v.encode()) for k, v in headers.items()]})


def test_extract_identity_requires_verification_config_outside_dev(monkeypatch):
    monkeypatch.delenv("APP_ENV", raising=False)
    monkeypatch.delenv("AUTH_ALLOW_UNVERIFIED_JWT", raising=False)
    monkeypatch.delenv("AUTH_JWKS_URL", raising=False)

    with pytest.raises(HTTPException) as exc:
        _extract_identity(_jwt({"sub": "u1", "email": "u1@example.com"}))

    assert exc.value.status_code == 500
    assert "JWT verification is not configured" in exc.value.detail


def test_extract_identity_allows_unsigned_decode_in_dev(monkeypatch):
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.delenv("AUTH_JWKS_URL", raising=False)

    identity = _extract_identity(_jwt({"sub": "u1", "email": "u1@example.com", "groups": ["ops"]}))

    assert identity.user_id == "u1"
    assert identity.email == "u1@example.com"
    assert identity.groups == ["ops"]


def test_extract_identity_accepts_malformed_dev_token_as_dev_user(monkeypatch):
    monkeypatch.setenv("APP_ENV", "local")
    monkeypatch.delenv("AUTH_JWKS_URL", raising=False)

    identity = _extract_identity("not-a-jwt")

    assert identity.user_id == "dev-user"
    assert identity.raw_token == "not-a-jwt"


def test_warn_if_jwks_unconfigured_passes_when_jwks_url_set(monkeypatch):
    """JWKS configured — startup proceeds with no error."""
    monkeypatch.setenv("AUTH_JWKS_URL", "https://example.com/oidc/jwks")
    monkeypatch.setenv("AUTH_JWT_AUDIENCE", "connectio-rad")
    monkeypatch.delenv("APP_ENV", raising=False)

    warn_if_jwks_unconfigured()


def test_warn_if_jwks_unconfigured_warns_when_audience_missing(monkeypatch, caplog):
    """JWKS audience drift is a warning because proxy headers carry identity."""
    monkeypatch.setenv("AUTH_JWKS_URL", "https://example.com/oidc/jwks")
    monkeypatch.delenv("AUTH_JWT_AUDIENCE", raising=False)
    monkeypatch.delenv("APP_ENV", raising=False)

    with caplog.at_level("WARNING", logger="shared_auth.identity"):
        warn_if_jwks_unconfigured()

    assert any("AUTH_JWT_AUDIENCE" in rec.message for rec in caplog.records)


def test_warn_if_jwks_unconfigured_passes_in_dev_without_jwks(monkeypatch):
    """Dev mode without JWKS is allowed — only warned about."""
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.delenv("AUTH_JWKS_URL", raising=False)
    monkeypatch.delenv("AUTH_ALLOW_UNVERIFIED_JWT", raising=False)

    warn_if_jwks_unconfigured()


def test_warn_if_jwks_unconfigured_warns_in_prod_without_jwks(monkeypatch, caplog):
    """Non-dev Databricks Apps still starts because proxy headers carry identity."""
    monkeypatch.delenv("APP_ENV", raising=False)
    monkeypatch.delenv("AUTH_JWKS_URL", raising=False)
    monkeypatch.delenv("AUTH_ALLOW_UNVERIFIED_JWT", raising=False)

    with caplog.at_level("WARNING", logger="shared_auth.identity"):
        warn_if_jwks_unconfigured()
    assert any("AUTH_JWKS_URL is not set" in rec.message for rec in caplog.records)


def test_warn_if_jwks_unconfigured_warns_for_unverified_opt_out_in_prod(monkeypatch, caplog):
    """AUTH_ALLOW_UNVERIFIED_JWT=true is tolerated but startup still only warns."""
    monkeypatch.delenv("APP_ENV", raising=False)
    monkeypatch.delenv("AUTH_JWKS_URL", raising=False)
    monkeypatch.setenv("AUTH_ALLOW_UNVERIFIED_JWT", "true")

    with caplog.at_level("WARNING", logger="shared_auth.identity"):
        warn_if_jwks_unconfigured()

    assert any("AUTH_JWKS_URL is not set" in rec.message for rec in caplog.records)


def test_require_proxy_user_uses_forwarded_identity_headers_without_jwks(monkeypatch):
    """Proxy-authenticated requests do not need local JWKS token decoding."""
    monkeypatch.delenv("APP_ENV", raising=False)
    monkeypatch.delenv("AUTH_JWKS_URL", raising=False)
    monkeypatch.delenv("AUTH_ALLOW_UNVERIFIED_JWT", raising=False)
    request = _request(
        {
            "x-forwarded-access-token": "opaque-databricks-access-token",
            "x-forwarded-user": "user-123",
            "x-forwarded-email": "ops@example.com",
            "x-forwarded-preferred-username": "Ops Lead",
        }
    )

    identity = asyncio.run(
        require_proxy_user(request, x_forwarded_access_token="opaque-databricks-access-token")
    )

    assert identity.user_id == "user-123"
    assert identity.email == "ops@example.com"
    assert identity.display_name == "Ops Lead"
    assert identity.raw_token == "opaque-databricks-access-token"


def test_require_user_keeps_dev_bearer_fallback(monkeypatch):
    """Local Bearer workflows can still decode developer JWTs."""
    monkeypatch.setenv("APP_ENV", "local")
    monkeypatch.delenv("AUTH_JWKS_URL", raising=False)
    request = _request({"authorization": f"Bearer {_jwt({'sub': 'dev-1', 'email': 'dev@example.com'})}"})

    identity = asyncio.run(
        require_user(request, x_forwarded_access_token=None, authorization=request.headers["authorization"])
    )

    assert identity.user_id == "dev-1"
    assert identity.email == "dev@example.com"


def test_warn_if_jwks_unconfigured_passes_in_dev_with_allow_flag(monkeypatch):
    """In dev mode the allow flag is irrelevant — dev mode returns early."""
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.delenv("AUTH_JWKS_URL", raising=False)
    monkeypatch.setenv("AUTH_ALLOW_UNVERIFIED_JWT", "true")

    warn_if_jwks_unconfigured()  # should not raise


# --- resolve_token strict-by-default behaviour --------------------------------


def test_resolve_token_default_is_strict_proxy_only(monkeypatch):
    """Default is strict — Bearer header is ignored even in dev mode."""
    monkeypatch.setenv("APP_ENV", "test")

    # x-forwarded-access-token present: returned regardless of Bearer.
    assert resolve_token("proxy-token", "Bearer should-be-ignored") == "proxy-token"

    # x-forwarded-access-token absent and only Bearer present: 401.
    with pytest.raises(HTTPException) as exc:
        resolve_token(None, "Bearer wont-fall-back")
    assert exc.value.status_code == 401


def test_resolve_token_strict_false_allows_bearer_in_dev(monkeypatch):
    """Explicit strict=False + dev mode honours the Bearer fallback."""
    monkeypatch.setenv("APP_ENV", "local")

    assert resolve_token(None, "Bearer dev-token", strict=False) == "dev-token"


def test_resolve_token_strict_false_allows_case_insensitive_bearer_in_dev(monkeypatch):
    """Bearer parsing is case-insensitive so local tooling can vary header casing."""
    monkeypatch.setenv("APP_ENV", "local")

    assert resolve_token(None, "bearer dev-token", strict=False) == "dev-token"


def test_resolve_token_rejects_blank_bearer_token(monkeypatch):
    """A Bearer scheme without a token is treated as missing auth."""
    monkeypatch.setenv("APP_ENV", "local")

    with pytest.raises(HTTPException) as exc:
        resolve_token(None, "Bearer   ", strict=False)

    assert exc.value.status_code == 401


def test_resolve_token_strict_false_ignored_in_production(monkeypatch, caplog):
    """Outside dev mode, strict=False is downgraded to strict and a warning is logged.

    Defends against routes that haven't been migrated to require_proxy_user
    silently letting Bearer-only callers through in prod.
    """
    monkeypatch.delenv("APP_ENV", raising=False)

    with caplog.at_level("WARNING", logger="shared_auth.identity"):
        with pytest.raises(HTTPException) as exc:
            resolve_token(None, "Bearer attacker-token", strict=False)

    assert exc.value.status_code == 401
    assert any("strict=False" in rec.message for rec in caplog.records)


def test_resolve_token_strict_false_in_dev_still_prefers_proxy_token(monkeypatch):
    """When both headers are present, the proxy token wins regardless of strict."""
    monkeypatch.setenv("APP_ENV", "development")

    assert resolve_token("proxy-token", "Bearer dev-token", strict=False) == "proxy-token"


def test_resolve_token_explicit_strict_true_rejects_bearer_everywhere(monkeypatch):
    """strict=True is the production guarantee — Bearer is never used."""
    monkeypatch.setenv("APP_ENV", "test")  # even in dev

    with pytest.raises(HTTPException) as exc:
        resolve_token(None, "Bearer dev-token", strict=True)
    assert exc.value.status_code == 401
