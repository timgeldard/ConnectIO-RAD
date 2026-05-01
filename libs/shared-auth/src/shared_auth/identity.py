from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any, Optional

import jwt
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
    Internal helper to extract identity from a (potentially unverified) token.
    """
    is_dev = os.environ.get("APP_ENV", "").lower() in ("development", "local", "test")
    
    try:
        # Real validation logic will go here once JWKS is integrated.
        # For now we do best-effort extraction.
        payload = jwt.decode(token, options={"verify_signature": False})
        
        return UserIdentity(
            user_id=payload.get("sub") or payload.get("email") or "unknown",
            email=payload.get("email"),
            display_name=payload.get("name") or payload.get("preferred_username"),
            groups=payload.get("groups") or [],
            raw_token=token
        )
    except Exception:
        # Strict mode: if it's not a JWT, it's invalid unless in dev
        if not is_dev:
            raise HTTPException(status_code=401, detail="Invalid token format.")
            
        return UserIdentity(
            user_id="dev-user",
            raw_token=token
        )
