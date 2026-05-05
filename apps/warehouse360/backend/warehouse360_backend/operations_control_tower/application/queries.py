"""Application query handlers for Warehouse360 operations control tower."""

from __future__ import annotations

from typing import Optional

from warehouse360_backend.inventory_management.domain.plant_scope import PlantScope
from warehouse360_backend.operations_control_tower.dal import kpis as kpis_dal
from warehouse360_backend.operations_control_tower.domain.kpi_health import (
    KpiThreshold,
    classify_kpi_health,
)

# Standard rate-based thresholds for warehouse operations KPIs (0.0-1.0)
_DEFAULT_KPI_THRESHOLD = KpiThreshold(warning=0.9, critical=0.8)


async def list_kpis(token: str, plant_id: Optional[str] = None) -> list[dict]:
    """Return KPI rows for the selected plant scope.

    Each row is enriched with ``kpi_health`` (HEALTHY, WARNING, CRITICAL)
    derived from ``kpi_value`` against standard operation thresholds.
    """
    scope = PlantScope.from_optional(plant_id)
    rows = await kpis_dal.fetch_kpis(token, plant_id=scope.plant_id)
    for row in rows:
        val_raw = row.get("kpi_value")
        if val_raw is None:
            row["kpi_health"] = "HEALTHY"
            continue

        try:
            val = float(val_raw)
            row["kpi_health"] = classify_kpi_health(val, _DEFAULT_KPI_THRESHOLD)
        except (ValueError, TypeError):
            row["kpi_health"] = "HEALTHY"  # Fallback for non-numeric data
    return rows
