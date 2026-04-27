"""DAL — warehouse KPI snapshot."""

from backend.utils.db import run_sql_async, sql_param, tbl


async def fetch_kpi_snapshot(token: str, plant_id: str | None = None) -> dict:
    """Return the current KPI snapshot as a single dict.

    wh360_kpi_snapshot_v returns one row per plant. When no plant is selected,
    return the first available plant-level snapshot.
    Returns an empty dict if no row is present.
    """
    params = [sql_param("plant_id", plant_id)] if plant_id else []
    plant_filter = "WHERE plant_id = :plant_id" if plant_id else ""
    q = f"""
        SELECT *
        FROM {tbl('wh360_kpi_snapshot_v')}
        {plant_filter}
        ORDER BY plant_id
        LIMIT 1
    """
    rows = await run_sql_async(token, q, params, endpoint_hint="wh360.kpi_snapshot")
    return rows[0] if rows else {}
