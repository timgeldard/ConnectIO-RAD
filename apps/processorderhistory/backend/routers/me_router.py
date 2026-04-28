"""User identity endpoint — GET /api/me."""
from typing import Optional

from fastapi import APIRouter, Header

from backend.db import check_warehouse_config, resolve_token, run_sql_async

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
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """Return the name and initials of the authenticated user via current_user()."""
    token = resolve_token(x_forwarded_access_token, authorization)
    check_warehouse_config()
    rows = await run_sql_async(token, "SELECT current_user() AS email", endpoint_hint="poh.me")
    email = str(rows[0]["email"]) if rows else ""
    name, initials = _name_from_email(email)
    return {"name": name, "initials": initials, "email": email}
