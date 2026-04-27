"""DAL — warehouse bin stock (LAGP/LQUA) and line-side replenishment stock."""

from backend.utils.db import run_sql_async, sql_param, tbl


async def fetch_bin_stock(token: str) -> list[dict]:
    """Return current stock by warehouse bin, ordered by storage type then bin."""
    q = f"""
        SELECT *
        FROM {tbl('wh360_bin_stock_v')}
        ORDER BY lgtyp, bin_id
        LIMIT 2000
    """
    return await run_sql_async(token, q, [], endpoint_hint="wh360.bin_stock")


async def fetch_lineside(token: str, plant_id: str | None = None) -> list[dict]:
    """Return current line-side stock positions ordered by material."""
    params = [sql_param("plant_id", plant_id)] if plant_id else []
    plant_filter = "WHERE plant_id = :plant_id" if plant_id else ""
    q = f"""
        SELECT *
        FROM {tbl('wh360_lineside_stock_v')}
        {plant_filter}
        ORDER BY material_id
        LIMIT 500
    """
    return await run_sql_async(token, q, params, endpoint_hint="wh360.lineside")
