"""Schedule Adherence analytics router — POST /api/adherence/analytics."""
from typing import Optional

from shared_auth import UserIdentity, require_user
from fastapi import Depends, APIRouter, Header
from pydantic import BaseModel

from backend.dal.adherence_analytics_dal import fetch_adherence_analytics
from backend.db import check_warehouse_config, validate_timezone

router = APIRouter()


class AdherenceAnalyticsRequest(BaseModel):
    """Request body for the schedule adherence analytics endpoint."""

    plant_id: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    timezone: Optional[str] = None


@router.post("/adherence/analytics")
async def get_adherence_analytics(body: AdherenceAnalyticsRequest,
    user: UserIdentity = Depends(require_user)
):
    """Return schedule adherence analytics: OTIF rate trend and order-level variance.

    ``date_from`` / ``date_to`` are ISO date strings (YYYY-MM-DD); omitting both
    returns the last 7 days for the order-level list.
    """
    token = user.raw_token
    check_warehouse_config()
    return await fetch_adherence_analytics(
        token,
        plant_id=body.plant_id,
        date_from=body.date_from,
        date_to=body.date_to,
        timezone=validate_timezone(body.timezone),
    )
