"""Equipment insights router — POST /api/equipment-insights/summary."""
from typing import Optional

from fastapi import APIRouter, Header
from pydantic import BaseModel

from backend.dal.equipment_insights_dal import fetch_equipment_insights
from backend.db import check_warehouse_config, resolve_token

router = APIRouter()


class EquipmentInsightsRequest(BaseModel):
    """Request body for the equipment insights endpoint."""

    plant_id: Optional[str] = None


@router.post("/equipment-insights/summary")
async def get_equipment_insights(
    body: EquipmentInsightsRequest,
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """Return equipment master distribution from vw_gold_instrument.

    Provides instrument counts grouped by EQUIPMENT_TYPE for the Equipment Insights
    dashboard.  Scale verification data is not included — see the TODO in the
    frontend EquipmentInsights page for the placeholder.

    Optional ``plant_id`` filter restricts results to a single plant.
    """
    token = resolve_token(x_forwarded_access_token, authorization)
    check_warehouse_config()
    return await fetch_equipment_insights(token, plant_id=body.plant_id)
