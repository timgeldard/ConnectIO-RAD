"""Pours analytics router — POST /api/pours/analytics."""
from typing import Optional

from shared_auth import UserIdentity, require_proxy_user
from fastapi import Depends, APIRouter, Header
from pydantic import BaseModel

from backend.order_execution.application import queries as order_queries
from backend.db import check_warehouse_config, validate_timezone

router = APIRouter()


class PoursAnalyticsRequest(BaseModel):
    """Request body for the pours analytics endpoint."""

    plant_id: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    timezone: Optional[str] = None


@router.post("/pours/analytics")
async def get_pours_analytics(body: PoursAnalyticsRequest,
    user: UserIdentity = Depends(require_proxy_user)
):
    """Return pour analytics: 30-day daily series, 24h hourly series, events for the requested range.

    Pours are movement type-261 (goods issues). Series are pre-aggregated per
    process line and keyed by line ID; the 'ALL' key aggregates across all lines.
    ``planned_24h`` is the count of silver process orders whose SCHEDULED_START
    falls within the requested date range (defaults to last 24 hours).
    ``date_from`` / ``date_to`` are ISO date strings (YYYY-MM-DD); omitting both
    returns the last-24h rolling window.
    """
    token = user.raw_token
    check_warehouse_config()
    return await order_queries.get_pours_analytics(
        token,
        plant_id=body.plant_id,
        date_from=body.date_from,
        date_to=body.date_to,
        timezone=validate_timezone(body.timezone),
    )
