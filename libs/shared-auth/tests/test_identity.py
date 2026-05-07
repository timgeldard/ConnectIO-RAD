import jwt
import pytest
from fastapi import HTTPException

from shared_auth.identity import _extract_identity, warn_if_jwks_unconfigured


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


def test_warn_if_jwks_unconfigured_allows_explicit_unverified_opt_out(monkeypatch):
    """Setting AUTH_ALLOW_UNVERIFIED_JWT=true is an explicit acknowledgement
    that the deploy is running without verification — startup proceeds."""
    monkeypatch.delenv("APP_ENV", raising=False)
    monkeypatch.delenv("AUTH_JWKS_URL", raising=False)
    monkeypatch.setenv("AUTH_ALLOW_UNVERIFIED_JWT", "true")

    warn_if_jwks_unconfigured()
