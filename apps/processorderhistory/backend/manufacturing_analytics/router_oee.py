"""OEE analytics router — POST /api/oee/analytics."""
from typing import Optional

from shared_auth import UserIdentity, require_proxy_user
from fastapi import Depends, APIRouter, Header
from pydantic import BaseModel

from backend.manufacturing_analytics.application import queries as analytics_queries
from backend.db import check_warehouse_config, validate_timezone

router = APIRouter()


class OEEAnalyticsRequest(BaseModel):
    """Request body for the OEE analytics endpoint."""

    plant_id: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    timezone: Optional[str] = None


@router.post("/oee/analytics")
async def get_oee_analytics(body: OEEAnalyticsRequest,
    user: UserIdentity = Depends(require_proxy_user)
):
    """Return OEE analytics: 30-day weighted trend and per-line performance.

    ``date_from`` / ``date_to`` are ISO date strings (YYYY-MM-DD); omitting both
    returns the last 7 days for the per-line aggregation.
    """
    token = user.raw_token
    check_warehouse_config()
    return await analytics_queries.get_oee_analytics(
        token,
        plant_id=body.plant_id,
        date_from=body.date_from,
        date_to=body.date_to,
        timezone=validate_timezone(body.timezone),
    )
