"""Yield analytics router — POST /api/yield/analytics."""
from typing import Optional

from fastapi import APIRouter, Header
from pydantic import BaseModel

from backend.dal.yield_analytics_dal import fetch_yield_analytics
from backend.db import check_warehouse_config, resolve_token

router = APIRouter()


class YieldAnalyticsRequest(BaseModel):
    """Request body for the yield analytics endpoint."""

    plant_id: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None


@router.post("/yield/analytics")
async def get_yield_analytics(
    body: YieldAnalyticsRequest,
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """Return yield analytics: per-order yield, 30-day daily series, 24h hourly series.

    Yield = (MT-101 received kg / MT-261 issued kg) × 100.
    ``date_from`` / ``date_to`` are ISO date strings (YYYY-MM-DD); omitting both
    returns the last-24h rolling window.
    """
    token = resolve_token(x_forwarded_access_token, authorization)
    check_warehouse_config()
    return await fetch_yield_analytics(
        token,
        plant_id=body.plant_id,
        date_from=body.date_from,
        date_to=body.date_to,
    )
