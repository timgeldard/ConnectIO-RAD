"""Lab Board router."""

from fastapi import APIRouter, Depends, Query
from shared_auth.identity import UserIdentity, require_proxy_user

from connectedquality_backend.application.lab import fetch_lab_failures

router = APIRouter()


@router.get("/lab/fails")
async def lab_fails(
    plant_id: str = Query(..., description="Plant selected by the user/session/deep link."),
    lot_type: str | None = Query(default=None, description="Optional SAP inspection lot type."),
    user: UserIdentity = Depends(require_proxy_user),
):
    """Inspection lot characteristics that have failed or are out-of-warning."""
    return await fetch_lab_failures(user.raw_token, plant_id=plant_id, lot_type=lot_type)
