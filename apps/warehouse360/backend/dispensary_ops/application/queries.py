"""Application query handlers for Warehouse360 dispensary operations."""

from __future__ import annotations

from typing import Optional

from backend.dispensary_ops.dal import dispensary as dispensary_dal
from backend.dispensary_ops.domain.task_status import is_urgent
from backend.inventory_management.domain.plant_scope import PlantScope


async def list_dispensary_tasks(token: str, plant_id: Optional[str] = None) -> list[dict]:
    """Return dispensary tasks for the selected plant scope.

    Each task row is enriched with ``is_urgent`` (bool) derived from
    ``mins_to_start``. status_normalized is omitted until the upstream
    view wh360_dispensary_tasks_v includes a status column.
    """
    scope = PlantScope.from_optional(plant_id)
    rows = await dispensary_dal.fetch_dispensary_tasks(token, plant_id=scope.plant_id)
    for row in rows:
        # Default to OPEN since the view doesn't emit status yet.
        row["is_urgent"] = is_urgent("OPEN", row.get("mins_to_start"))
    return rows
