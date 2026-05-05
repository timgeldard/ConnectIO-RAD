"""User identity and preferences endpoints — GET /api/me, GET/POST /api/me/preferences."""

from shared_auth import UserIdentity, require_proxy_user
from fastapi import Depends, APIRouter
from pydantic import BaseModel

from processorderhistory_backend.db import check_warehouse_config
from processorderhistory_backend.prefs_store import get_pinned, set_pinned
from processorderhistory_backend.order_execution.application.user_queries import get_user_email

router = APIRouter()


def _name_from_email(email: str) -> tuple[str, str]:
    """Derive display name and initials from a firstname.lastname@domain email."""
    local = email.split("@")[0]
    parts = [p.capitalize() for p in local.replace("-", ".").split(".") if p]
    name = " ".join(parts) if parts else email
    initials = "".join(p[0].upper() for p in parts[:2]) if parts else "?"
    return name, initials


@router.get("/me")
async def get_me(
    user: UserIdentity = Depends(require_proxy_user)
):
    """Return the name and initials of the authenticated user via current_user()."""
    token = user.raw_token
    check_warehouse_config()
    email = await get_user_email(token)
    name, initials = _name_from_email(email)
    return {"name": name, "initials": initials, "email": email}


class PreferencesPayload(BaseModel):
    """Request body for POST /api/me/preferences."""

    app_id: str
    pinned_modules: list[str]


@router.get("/me/preferences")
async def get_preferences(
    app_id: str,
    user: UserIdentity = Depends(require_proxy_user),
):
    """Return the user's pinned module list for the given app.

    ``pinned_modules`` is null when the user has no saved record,
    signalling the shell to display all modules (factory-default view).
    """
    pinned = get_pinned(user.user_id, app_id)
    return {"pinned_modules": pinned}


@router.post("/me/preferences")
async def save_preferences(
    payload: PreferencesPayload,
    user: UserIdentity = Depends(require_proxy_user),
):
    """Persist the user's pinned module list for the given app."""
    set_pinned(user.user_id, payload.app_id, payload.pinned_modules)
    return {"ok": True}
