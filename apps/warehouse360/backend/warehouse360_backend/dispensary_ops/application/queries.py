"""Application query handlers for Warehouse360 dispensary operations."""

from __future__ import annotations

from typing import Optional

from warehouse360_backend.dispensary_ops.dal import dispensary as dispensary_dal
from warehouse360_backend.dispensary_ops.domain.task_status import is_urgent, normalize_task_status
from warehouse360_backend.inventory_management.domain.plant_scope import PlantScope


async def list_dispensary_tasks(token: str, plant_id: Optional[str] = None) -> list[dict]:
    """Return dispensary tasks for the selected plant scope.

    Each task row is enriched with ``status_normalized`` (canonical TaskStatus)
    and ``is_urgent`` (bool) derived from ``mins_to_start``.
    """
    scope = PlantScope.from_optional(plant_id)
    rows = await dispensary_dal.fetch_dispensary_tasks(token, plant_id=scope.plant_id)
    for row in rows:
        status = normalize_task_status(row.get("status"))
        row["status_normalized"] = status
        row["is_urgent"] = is_urgent(status, row.get("mins_to_start"))
    return rows
