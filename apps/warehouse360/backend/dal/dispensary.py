"""DAL — dispensary weighing tasks."""

from backend.utils.db import run_sql_async, sql_param, tbl


async def fetch_dispensary_tasks(token: str, plant_id: str | None = None) -> list[dict]:
    """Return open dispensary tasks ordered by time until required."""
    params = [sql_param("plant_id", plant_id)] if plant_id else []
    plant_filter = "WHERE plant_id = :plant_id" if plant_id else ""
    q = f"""
        SELECT *
        FROM {tbl('wh360_dispensary_tasks_v')}
        {plant_filter}
        ORDER BY mins_to_start
        LIMIT 500
    """
    return await run_sql_async(token, q, params, endpoint_hint="wh360.dispensary_tasks")
