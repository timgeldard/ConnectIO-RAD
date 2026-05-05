"""Equipment insights router — POST /api/equipment-insights/summary."""
from typing import Optional

from shared_auth import UserIdentity, require_proxy_user
from fastapi import Depends, APIRouter
from pydantic import BaseModel

from processorderhistory_backend.manufacturing_analytics.application import queries as analytics_queries
from processorderhistory_backend.db import check_warehouse_config, validate_timezone

router = APIRouter()


class EquipmentInsightsRequest(BaseModel):
    """Request body for the equipment insights endpoint."""

    plant_id: Optional[str] = None
    timezone: str = "UTC"


@router.post("/equipment-insights/summary")
async def get_equipment_insights(body: EquipmentInsightsRequest,
    user: UserIdentity = Depends(require_proxy_user)
):
    """Return equipment master distribution and live activity from vw_gold_instrument and vw_gold_equipment_history.

    Provides instrument counts by EQUIPMENT_TYPE (estate), instrument state distribution
    (in_use / dirty / available / unknown from latest STATUS_TO), and active-instrument
    trend series (30-day daily and 24-hour hourly) for the Equipment Insights dashboard.

    Scale verification data is not included — see the TODO in the frontend
    EquipmentInsights page for the placeholder.

    Optional ``plant_id`` filter restricts results to a single plant.
    ``timezone`` is an IANA timezone name used for day/hour bucket alignment; invalid
    values are silently coerced to UTC.
    """
    token = user.raw_token
    check_warehouse_config()
    tz = validate_timezone(body.timezone)
    return await analytics_queries.get_equipment_insights(token, plant_id=body.plant_id, timezone=tz)
