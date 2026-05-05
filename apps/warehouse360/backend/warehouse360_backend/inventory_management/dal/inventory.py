"""DAL — warehouse bin stock (LAGP/LQUA) and line-side replenishment stock."""

from warehouse360_backend.utils.db import run_sql_async, sql_param, tbl
from warehouse360_backend.inventory_management.domain.plant_scope import PlantScope


def _plant_scope_filter(plant_id: str | None) -> tuple[str, list[dict]]:
    scope = PlantScope.from_optional(plant_id)
    if not scope.is_single_plant:
        return "", []
    return "WHERE plant_id = :plant_id", [sql_param("plant_id", scope.plant_id)]


async def fetch_bin_stock(token: str, plant_id: str | None = None) -> list[dict]:
    """Return current stock by warehouse bin, ordered by storage type then bin."""
    plant_filter, params = _plant_scope_filter(plant_id)
    q = f"""
        SELECT *
        FROM {tbl('wh360_bin_stock_v')}
        {plant_filter}
        ORDER BY lgtyp, bin_id
        LIMIT 2000
    """
    return await run_sql_async(token, q, params, endpoint_hint="wh360.bin_stock")


async def fetch_lineside(token: str, plant_id: str | None = None) -> list[dict]:
    """Return current line-side stock positions ordered by material."""
    plant_filter, params = _plant_scope_filter(plant_id)
    q = f"""
        SELECT *
        FROM {tbl('wh360_lineside_stock_v')}
        {plant_filter}
        ORDER BY material_id
        LIMIT 500
    """
    return await run_sql_async(token, q, params, endpoint_hint="wh360.lineside")
