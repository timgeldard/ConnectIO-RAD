"""Schedule Adherence analytics router — POST /api/adherence/analytics."""
from typing import Optional

from fastapi import APIRouter, Header
from pydantic import BaseModel

from backend.dal.adherence_analytics_dal import fetch_adherence_analytics
from backend.db import check_warehouse_config, resolve_token, validate_timezone

router = APIRouter()


class AdherenceAnalyticsRequest(BaseModel):
    """Request body for the schedule adherence analytics endpoint."""

    plant_id: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    timezone: Optional[str] = None


@router.post("/adherence/analytics")
async def get_adherence_analytics(
    body: AdherenceAnalyticsRequest,
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """Return schedule adherence analytics: OTIF rate trend and order-level variance.

    ``date_from`` / ``date_to`` are ISO date strings (YYYY-MM-DD); omitting both
    returns the last 7 days for the order-level list.
    """
    token = resolve_token(x_forwarded_access_token, authorization)
    check_warehouse_config()
    return await fetch_adherence_analytics(
        token,
        plant_id=body.plant_id,
        date_from=body.date_from,
        date_to=body.date_to,
        timezone=validate_timezone(body.timezone),
    )
