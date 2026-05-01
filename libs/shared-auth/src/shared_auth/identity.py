from __future__ import annotations

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
) -> str:
    """
    Resolve the access token from request headers (priority order).
    """
    token = x_forwarded_access_token
    if token is None and authorization and authorization.startswith("Bearer "):
        token = authorization[len("Bearer "):]
    if not token:
        raise HTTPException(
            status_code=401,
            detail=(
                "No access token present. Expected x-forwarded-access-token "
                "header (set by Databricks Apps proxy) or Authorization: Bearer."
            ),
        )
    return token


async def require_user(
    request: Request,
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
) -> UserIdentity:
    """
    FastAPI dependency to require a valid user identity.
    
    This performs token resolution and (optionally) JWT validation.
    """
    token = resolve_token(x_forwarded_access_token, authorization)
    
    try:
        # For now, we do unverified decoding to extract identity info.
        # Real validation will be added once JWKS endpoints are configured.
        payload = jwt.decode(token, options={"verify_signature": False})
        
        # Databricks / standard OIDC claims
        user_id = payload.get("sub") or payload.get("email") or "unknown"
        email = payload.get("email")
        display_name = payload.get("name") or payload.get("preferred_username")
        groups = payload.get("groups") or []
        if isinstance(groups, str):
            groups = [groups]

        return UserIdentity(
            user_id=user_id,
            email=email,
            display_name=display_name,
            groups=groups,
            raw_token=token
        )
    except Exception:
        # Fallback for non-JWT tokens (e.g. personal access tokens used in dev)
        # We treat the token as the user_id if it's not a JWT.
        return UserIdentity(
            user_id="dev-user",
            raw_token=token
        )
