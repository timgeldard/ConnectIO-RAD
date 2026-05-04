"""Application query handlers for Warehouse360 operations control tower."""

from __future__ import annotations

from typing import Optional

from backend.inventory_management.domain.plant_scope import PlantScope
from backend.operations_control_tower.dal import kpis as kpis_dal


async def list_kpis(token: str, plant_id: Optional[str] = None) -> list[dict]:
    """Return KPI rows for the selected plant scope."""

    scope = PlantScope.from_optional(plant_id)
    return await kpis_dal.fetch_kpis(token, plant_id=scope.plant_id)
