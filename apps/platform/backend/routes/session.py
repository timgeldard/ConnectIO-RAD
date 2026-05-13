import asyncio
import hashlib
import json
import os
import urllib.request
from typing import Optional

from cachetools import TTLCache
from fastapi import APIRouter, Depends

from shared_auth.identity import UserIdentity, require_proxy_user

router = APIRouter()

# SCIM responses are stable within a session; cache per-user for 10 minutes.
_scim_cache: TTLCache = TTLCache(maxsize=256, ttl=600)


def _first_name(display_name: str | None, email: str | None) -> str:
    """Derive a friendly first-name from available identity fields.

    Prefers the JWT ``name`` claim (e.g. "Tim Geldard" → "Tim").
    Falls back to the email local part when no display name is available
    (e.g. "tim.geldard@kerry.com" → "Tim").

    Args:
        display_name: Full display name from the JWT ``name`` claim, or
            ``None`` if the claim was absent.
        email: The user's email address, used as a fallback source.

    Returns:
        A capitalised first name string, never empty.
    """
    if display_name and "@" not in display_name:
        return display_name.split()[0]
    # display_name is an email, or absent — extract from whichever is available
    email_src = email or display_name or ""
    local = email_src.split("@")[0]
    if local:
        return local.split(".")[0].capitalize()
    return "there"


def _fetch_scim_me(raw_token: str) -> tuple[Optional[str], Optional[str]]:
    """Call Databricks SCIM /Me synchronously and return (display_name, email).

    Used as a fallback when the forwarded JWT carries no name/email claims,
    which happens with some AAD token configurations on Azure Databricks.

    Args:
        raw_token: The raw bearer token forwarded by the Databricks Apps proxy.

    Returns:
        A (display_name, email) tuple; either value may be None on failure.
    """
    host = os.environ.get("DATABRICKS_HOST", "").rstrip("/")
    if not host:
        return None, None
    req = urllib.request.Request(
        f"{host}/api/2.0/preview/scim/v2/Me",
        headers={"Authorization": f"Bearer {raw_token}", "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read())
        display_name = data.get("displayName")
        email = next(
            (e.get("value") for e in data.get("emails", []) if e.get("primary")),
            data.get("userName"),
        )
        return display_name, email
    except Exception:
        return None, None


async def _resolve_identity(user: UserIdentity) -> tuple[Optional[str], Optional[str]]:
    """Return (display_name, email) for *user*, falling back to SCIM when JWT claims are absent.

    Args:
        user: Authenticated platform user.

    Returns:
        A (display_name, email) tuple sourced from JWT claims or the SCIM /Me endpoint.
    """
    if user.display_name or user.email:
        return user.display_name, user.email
    # JWT carried no name/email — look up the workspace SCIM directory once and cache.
    token_key = hashlib.sha256(user.raw_token.encode()).hexdigest()[:16]
    if token_key not in _scim_cache:
        _scim_cache[token_key] = await asyncio.to_thread(_fetch_scim_me, user.raw_token)
    return _scim_cache[token_key]


@router.get("/api/platform/me", tags=["Platform"])
async def get_platform_session(
    user: UserIdentity = Depends(require_proxy_user),
) -> dict[str, str | list[str] | None]:
    """Return the authenticated shell user for Platform-owned UI context.

    Args:
        user: The authenticated user's identity, injected as a dependency.

    Returns:
        A dictionary containing the user's session information.
    """
    display_name, email = await _resolve_identity(user)
    return {
        "userId": user.user_id,
        "email": email,
        "name": _first_name(display_name, email),
        "groups": user.groups,
    }
