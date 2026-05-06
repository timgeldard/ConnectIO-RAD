"""User identity and preferences endpoints — GET /api/cq/me, GET/POST /api/cq/me/preferences."""
from shared_auth import UserIdentity, require_proxy_user
from fastapi import Depends, APIRouter
from pydantic import BaseModel

from connectedquality_backend.user_preferences.application.preferences import get_pinned, set_pinned

router = APIRouter()


def _name_from_email(email: str) -> tuple[str, str]:
    """Derive display name and initials from a firstname.lastname@domain email."""
    local = email.split("@")[0]
    parts = [p.capitalize() for p in local.replace("-", ".").split(".") if p]
    name = " ".join(parts) if parts else email
    initials = "".join(p[0].upper() for p in parts[:2]) if parts else "?"
    return name, initials


@router.get("/me")
async def get_me(user: UserIdentity = Depends(require_proxy_user)):
    """Return the name and initials of the authenticated user."""
    name, initials = _name_from_email(user.email or user.user_id)
    return {"name": name, "initials": initials}


class PreferencesPayload(BaseModel):
    """Request body for POST /api/cq/me/preferences."""

    app_id: str
    pinned_modules: list[str]


@router.get("/me/preferences")
async def get_preferences(
    app_id: str,
    user: UserIdentity = Depends(require_proxy_user),
):
    """Return the user's pinned module list for the given app."""
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
