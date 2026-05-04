"""Application query handlers for Warehouse360 operations control tower."""

from __future__ import annotations

from typing import Optional

from backend.inventory_management.domain.plant_scope import PlantScope
from backend.operations_control_tower.dal import kpis as kpis_dal
from backend.operations_control_tower.domain.kpi_health import (
    KpiThreshold,
    classify_kpi_health,
)

_DEFAULT_THRESHOLD = KpiThreshold(warning=0.90, critical=0.80)


async def list_kpis(token: str, plant_id: Optional[str] = None) -> list[dict]:
    """Return KPI rows for the selected plant scope.

    Each KPI row is enriched with a ``kpi_health`` field (HEALTHY / WARNING /
    CRITICAL) derived from the ``kpi_value`` field in ``wh360_kpi_snapshot_v``
    against a default 90%/80% threshold pair.
    """
    scope = PlantScope.from_optional(plant_id)
    rows = await kpis_dal.fetch_kpis(token, plant_id=scope.plant_id)
    for row in rows:
        value = row.get("kpi_value")
        if value is not None:
            row["kpi_health"] = classify_kpi_health(float(value), _DEFAULT_THRESHOLD)
        else:
            row["kpi_health"] = "HEALTHY"
    return rows
