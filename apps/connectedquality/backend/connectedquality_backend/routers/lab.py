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
    """Return failed or warning inspection characteristics for a plant.

    Args:
        plant_id: Plant selected by the user, session, or deep link.
        lot_type: Optional SAP inspection lot type filter.
        user: Authenticated platform user carrying the Databricks token.

    Returns:
        Lab Board payload containing normalized failure rows and availability
        metadata.
    """
    return await fetch_lab_failures(user.raw_token, plant_id=plant_id, lot_type=lot_type)
