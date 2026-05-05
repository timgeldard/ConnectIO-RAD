"""DAL — warehouse KPI snapshot."""

from warehouse360_backend.utils.db import run_sql_async, sql_param, tbl
from warehouse360_backend.inventory_management.domain.plant_scope import PlantScope


def _plant_scope_filter(plant_id: str | None) -> tuple[str, list[dict]]:
    scope = PlantScope.from_optional(plant_id)
    if not scope.is_single_plant:
        return "", []
    return "WHERE plant_id = :plant_id", [sql_param("plant_id", scope.plant_id)]


async def fetch_kpis(token: str, plant_id: str | None = None) -> list[dict]:
    """Return KPI rows for all plants, or a single plant if plant_id is given."""
    plant_filter, params = _plant_scope_filter(plant_id)
    q = f"""
        SELECT *
        FROM {tbl('wh360_kpi_snapshot_v')}
        {plant_filter}
        ORDER BY plant_id
    """
    return await run_sql_async(token, q, params, endpoint_hint="wh360.kpis")


async def fetch_kpi_snapshot(token: str, plant_id: str | None = None) -> dict:
    """Return the current KPI snapshot as a single dict.

    wh360_kpi_snapshot_v returns one row per plant. When no plant is selected,
    return the first available plant-level snapshot.
    Returns an empty dict if no row is present.
    """
    plant_filter, params = _plant_scope_filter(plant_id)
    q = f"""
        SELECT *
        FROM {tbl('wh360_kpi_snapshot_v')}
        {plant_filter}
        ORDER BY plant_id
        LIMIT 1
    """
    rows = await run_sql_async(token, q, params, endpoint_hint="wh360.kpi_snapshot")
    return rows[0] if rows else {}
