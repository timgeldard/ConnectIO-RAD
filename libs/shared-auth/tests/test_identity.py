import jwt
import pytest
from fastapi import HTTPException

from shared_auth.identity import _extract_identity, resolve_token, warn_if_jwks_unconfigured


def _jwt(payload: dict) -> str:
    return jwt.encode(payload, key="dev-secret-with-at-least-32-bytes", algorithm="HS256")


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
    monkeypatch.delenv("APP_ENV", raising=False)

    warn_if_jwks_unconfigured()


def test_warn_if_jwks_unconfigured_passes_in_dev_without_jwks(monkeypatch):
    """Dev mode without JWKS is allowed — only warned about."""
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.delenv("AUTH_JWKS_URL", raising=False)
    monkeypatch.delenv("AUTH_ALLOW_UNVERIFIED_JWT", raising=False)

    warn_if_jwks_unconfigured()


def test_warn_if_jwks_unconfigured_raises_in_prod_without_jwks(monkeypatch):
    """Non-dev environment with no JWKS and no opt-out flag must fail startup."""
    monkeypatch.delenv("APP_ENV", raising=False)
    monkeypatch.delenv("AUTH_JWKS_URL", raising=False)
    monkeypatch.delenv("AUTH_ALLOW_UNVERIFIED_JWT", raising=False)

    with pytest.raises(RuntimeError) as exc:
        warn_if_jwks_unconfigured()
    assert "AUTH_JWKS_URL is not configured" in str(exc.value)


def test_warn_if_jwks_unconfigured_raises_for_unverified_opt_out_in_prod(monkeypatch):
    """AUTH_ALLOW_UNVERIFIED_JWT=true in non-dev mode must raise — silent bypass
    is a security misconfiguration that must be surfaced at startup, not logged."""
    monkeypatch.delenv("APP_ENV", raising=False)
    monkeypatch.delenv("AUTH_JWKS_URL", raising=False)
    monkeypatch.setenv("AUTH_ALLOW_UNVERIFIED_JWT", "true")

    with pytest.raises(RuntimeError) as exc:
        warn_if_jwks_unconfigured()
    assert "AUTH_ALLOW_UNVERIFIED_JWT" in str(exc.value)


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
