"""Equipment Insights v2 router — POST /api/equipment-insights-v2/summary.

This router is a stub.  All endpoints return empty data until the gold views
for TTC, FTR, calibration, and anomaly detection are created in Unity Catalogue.
See ``equipment_insights2_dal.py`` for the full TODO list.
"""
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from shared_auth import UserIdentity, require_proxy_user

from backend.manufacturing_analytics.application import queries as analytics_queries
from backend.db import check_warehouse_config, validate_timezone

router = APIRouter()


class EquipmentInsights2Request(BaseModel):
    """Request body for the equipment insights v2 summary endpoint."""

    plant_id: Optional[str] = None
    timezone: str = "UTC"


@router.post("/equipment-insights-v2/summary")
async def get_equipment_insights2_summary(
    body: EquipmentInsights2Request,
    user: UserIdentity = Depends(require_proxy_user),
) -> dict:
    """Return Equipment Insights v2 — estate, cleaning, calibration, and anomaly data.

    Provides KPIs, state distribution bar, 7×24h activity heatmap, per-type
    aggregation, cleaning backlog, calibration register, anomaly list, and the
    full equipment register.

    Returns empty data until the gold views listed in ``equipment_insights2_dal.py``
    are available in Unity Catalogue.  The frontend renders graceful empty states
    for all sections until real data arrives.

    Optional ``plant_id`` filter restricts results to a single plant.
    ``timezone`` is an IANA timezone name used for day/hour bucket alignment.
    """
    token = user.raw_token
    check_warehouse_config()
    tz = validate_timezone(body.timezone)
    return await analytics_queries.get_equipment_insights2(token, plant_id=body.plant_id, timezone=tz)
