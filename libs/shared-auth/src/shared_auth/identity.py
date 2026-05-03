from __future__ import annotations

import os
from functools import lru_cache
from dataclasses import dataclass, field
from typing import Any, Optional

import jwt
from jwt import PyJWKClient
from fastapi import Header, HTTPException, Request


@dataclass(frozen=True)
class UserIdentity:
    """
    Standardized user identity extracted from the access token.
    """
    user_id: str
    email: Optional[str] = None
    display_name: Optional[str] = None
    groups: list[str] = field(default_factory=list)
    raw_token: str = field(repr=False, default="")

    @property
    def is_authenticated(self) -> bool:
        return bool(self.user_id)


def resolve_token(
    x_forwarded_access_token: Optional[str],
    authorization: Optional[str],
    strict: bool = False,
) -> str:
    """
    Resolve the access token from request headers (priority order).
    
    Args:
        x_forwarded_access_token: Token from Databricks Apps proxy.
        authorization: Standard Bearer token header.
        strict: If True, only x-forwarded-access-token is accepted.
    """
    token = x_forwarded_access_token
    
    if not strict and token is None and authorization and authorization.startswith("Bearer "):
        token = authorization[len("Bearer "):]
        
    if not token:
        msg = "No access token present. Expected x-forwarded-access-token header."
        if not strict:
            msg += " Fallback to Authorization: Bearer is also supported."
        raise HTTPException(status_code=401, detail=msg)
        
    return token


def _is_dev_mode() -> bool:
    return os.environ.get("APP_ENV", "").lower() in ("development", "local", "test")


def _allow_unverified_tokens() -> bool:
    return os.environ.get("AUTH_ALLOW_UNVERIFIED_JWT", "").strip().lower() in {"1", "true", "yes", "on"}


def _jwt_verification_config() -> tuple[str, str | None, str | None]:
    return (
        os.environ.get("AUTH_JWKS_URL", "").strip(),
        os.environ.get("AUTH_JWT_AUDIENCE", "").strip() or None,
        os.environ.get("AUTH_JWT_ISSUER", "").strip() or None,
    )


@lru_cache(maxsize=4)
def _jwk_client(jwks_url: str) -> PyJWKClient:
    return PyJWKClient(jwks_url)


async def require_user(
    request: Request,
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
) -> UserIdentity:
    """
    FastAPI dependency to require a valid user identity.
    
    Supports both proxy headers and local Bearer tokens.
    """
    token = resolve_token(x_forwarded_access_token, authorization, strict=False)
    return _extract_identity(token)


async def require_proxy_user(
    request: Request,
    x_forwarded_access_token: Optional[str] = Header(default=None),
) -> UserIdentity:
    """
    FastAPI dependency to require a valid user identity via Databricks Proxy only.
    
    Strictly enforces x-forwarded-access-token and rejects Authorization headers.
    """
    token = resolve_token(x_forwarded_access_token, None, strict=True)
    return _extract_identity(token)


def _extract_identity(token: str) -> UserIdentity:
    """
    Internal helper to extract identity from a verified token.

    Local/test environments may explicitly use unsigned decoding for developer
    ergonomics. Production deployments must configure JWKS validation.
    """
    payload = _decode_token(token)
    return UserIdentity(
        user_id=payload.get("sub") or payload.get("email") or "unknown",
        email=payload.get("email"),
        display_name=payload.get("name") or payload.get("preferred_username"),
        groups=payload.get("groups") or [],
        raw_token=token,
    )


def _decode_token(token: str) -> dict[str, Any]:
    jwks_url, audience, issuer = _jwt_verification_config()
    if jwks_url:
        try:
            signing_key = _jwk_client(jwks_url).get_signing_key_from_jwt(token)
            options = {"verify_aud": audience is not None}
            return jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256", "RS384", "RS512", "ES256", "ES384", "ES512"],
                audience=audience,
                issuer=issuer,
                options=options,
            )
        except Exception as exc:
            raise HTTPException(status_code=401, detail="Invalid access token.") from exc

    if not (_is_dev_mode() or _allow_unverified_tokens()):
        raise HTTPException(
            status_code=500,
            detail="JWT verification is not configured. Set AUTH_JWKS_URL for production.",
        )

    try:
        return jwt.decode(token, options={"verify_signature": False})
    except Exception as exc:
        if _is_dev_mode():
            return {"sub": "dev-user"}
        raise HTTPException(status_code=401, detail="Invalid token format.") from exc
