"""DAL — warehouse KPI snapshot."""

from backend.utils.db import run_sql_async, tbl


async def fetch_kpi_snapshot(token: str) -> dict:
    """Return the current KPI snapshot as a single dict.

    wh360_kpi_snapshot_v is expected to return exactly one row.
    Returns an empty dict if no row is present.
    """
    q = f"""
        SELECT *
        FROM {tbl('wh360_kpi_snapshot_v')}
    """
    rows = await run_sql_async(token, q, [], endpoint_hint="wh360.kpi_snapshot")
    return rows[0] if rows else {}
