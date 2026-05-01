"""Downtime analytics router — POST /api/downtime/analytics."""
from typing import Optional

from shared_auth import UserIdentity, require_user
from fastapi import Depends, APIRouter, Header
from pydantic import BaseModel

from backend.dal.downtime_analytics_dal import fetch_downtime_analytics
from backend.db import check_warehouse_config, validate_timezone

router = APIRouter()


class DowntimeAnalyticsRequest(BaseModel):
    """Request body for the downtime analytics endpoint."""

    plant_id: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    timezone: Optional[str] = None


@router.post("/downtime/analytics")
async def get_downtime_analytics(body: DowntimeAnalyticsRequest,
    user: UserIdentity = Depends(require_user)
):
    """Return downtime analytics: pareto by reason over the requested date range,
    and a 30-day daily series.

    ``date_from`` / ``date_to`` are ISO date strings (YYYY-MM-DD); omitting both
    returns the last-24h rolling window.
    """
    token = user.raw_token
    check_warehouse_config()
    return await fetch_downtime_analytics(
        token,
        plant_id=body.plant_id,
        date_from=body.date_from,
        date_to=body.date_to,
        timezone=validate_timezone(body.timezone),
    )
