"""DAL — dispensary weighing tasks."""

from backend.utils.db import run_sql_async, tbl


async def fetch_dispensary_tasks(token: str) -> list[dict]:
    """Return open dispensary tasks ordered by time until required."""
    q = f"""
        SELECT *
        FROM {tbl('wh360_dispensary_tasks_v')}
        ORDER BY mins_to_start
        LIMIT 500
    """
    return await run_sql_async(token, q, [], endpoint_hint="wh360.dispensary_tasks")
