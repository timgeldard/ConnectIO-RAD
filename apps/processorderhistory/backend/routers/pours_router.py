"""Pours analytics router — POST /api/pours/analytics."""
from typing import Optional

from fastapi import APIRouter, Header
from pydantic import BaseModel

from backend.dal.pours_analytics_dal import fetch_pours_analytics
from backend.db import check_warehouse_config, resolve_token, validate_timezone

router = APIRouter()


class PoursAnalyticsRequest(BaseModel):
    """Request body for the pours analytics endpoint."""

    plant_id: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    timezone: Optional[str] = None


@router.post("/pours/analytics")
async def get_pours_analytics(
    body: PoursAnalyticsRequest,
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """Return pour analytics: 30-day daily series, 24h hourly series, events for the requested range.

    Pours are movement type-261 (goods issues). Series are pre-aggregated per
    process line and keyed by line ID; the 'ALL' key aggregates across all lines.
    ``planned_24h`` is the count of silver process orders whose SCHEDULED_START
    falls within the requested date range (defaults to last 24 hours).
    ``date_from`` / ``date_to`` are ISO date strings (YYYY-MM-DD); omitting both
    returns the last-24h rolling window.
    """
    token = resolve_token(x_forwarded_access_token, authorization)
    check_warehouse_config()
    return await fetch_pours_analytics(
        token,
        plant_id=body.plant_id,
        date_from=body.date_from,
        date_to=body.date_to,
        timezone=validate_timezone(body.timezone),
    )
