"""DAL — dispensary weighing tasks."""

from warehouse360_backend.utils.db import run_sql_async, sql_param, tbl
from warehouse360_backend.inventory_management.domain.plant_scope import PlantScope


def _plant_scope_filter(plant_id: str | None) -> tuple[str, list[dict]]:
    scope = PlantScope.from_optional(plant_id)
    if not scope.is_single_plant:
        return "", []
    return "WHERE plant_id = :plant_id", [sql_param("plant_id", scope.plant_id)]


async def fetch_dispensary_tasks(token: str, plant_id: str | None = None) -> list[dict]:
    """Return open dispensary tasks ordered by time until required."""
    plant_filter, params = _plant_scope_filter(plant_id)
    q = f"""
        SELECT *
        FROM {tbl('wh360_dispensary_tasks_v')}
        {plant_filter}
        ORDER BY mins_to_start
        LIMIT 500
    """
    return await run_sql_async(token, q, params, endpoint_hint="wh360.dispensary_tasks")
