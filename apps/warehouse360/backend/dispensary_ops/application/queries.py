"""Application query handlers for Warehouse360 dispensary operations."""

from __future__ import annotations

from typing import Optional

from backend.dispensary_ops.dal import dispensary as dispensary_dal
from backend.inventory_management.domain.plant_scope import PlantScope


async def list_dispensary_tasks(token: str, plant_id: Optional[str] = None) -> list[dict]:
    """Return dispensary tasks for the selected plant scope."""

    scope = PlantScope.from_optional(plant_id)
    return await dispensary_dal.fetch_dispensary_tasks(token, plant_id=scope.plant_id)
