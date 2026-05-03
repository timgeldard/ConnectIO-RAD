import jwt
import pytest
from fastapi import HTTPException

from shared_auth.identity import _extract_identity


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
