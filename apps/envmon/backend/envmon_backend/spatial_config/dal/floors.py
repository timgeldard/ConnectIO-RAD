"""DAL — floor definitions: reads and admin writes to em_plant_floor."""

from envmon_backend.utils.db import run_sql_async, sql_param
from envmon_backend.utils.em_config import COORD_TBL, FLOOR_TBL


async def fetch_floors(token: str, plant_id: str) -> list[dict]:
    """Return floor metadata rows for a plant, ordered by sort_order."""
    params = [sql_param("plant_id", plant_id)]
    sql = f"""
        SELECT floor_id, floor_name, svg_url, svg_width, svg_height
        FROM {FLOOR_TBL}
        WHERE plant_id = :plant_id
        ORDER BY sort_order, floor_id
    """
    return await run_sql_async(token, sql, params)


async def fetch_floor_location_counts(token: str, plant_id: str) -> list[dict]:
    """Return per-floor mapped location counts for a plant."""
    params = [sql_param("plant_id", plant_id)]
    sql = f"""
        SELECT floor_id, COUNT(DISTINCT func_loc_id) AS location_count
        FROM {COORD_TBL}
        WHERE plant_id = :plant_id
        GROUP BY floor_id
    """
    return await run_sql_async(token, sql, params)


async def upsert_floor(
    token: str,
    plant_id: str,
    floor_id: str,
    floor_name: str,
    svg_url: str | None,
    svg_width: float | None,
    svg_height: float | None,
    sort_order: int,
) -> None:
    """Upsert a floor definition into em_plant_floor."""
    params = [
        sql_param("plant_id",   plant_id),
        sql_param("floor_id",   floor_id),
        sql_param("floor_name", floor_name),
        sql_param("svg_url",    svg_url or ""),
        sql_param("svg_width",  svg_width if svg_width is not None else 0.0),
        sql_param("svg_height", svg_height if svg_height is not None else 0.0),
        sql_param("sort_order", sort_order),
    ]
    sql = f"""
        MERGE INTO {FLOOR_TBL} AS t
        USING (SELECT
            :plant_id   AS plant_id,
            :floor_id   AS floor_id,
            :floor_name AS floor_name,
            NULLIF(:svg_url, '')    AS svg_url,
            NULLIF(:svg_width,  0)  AS svg_width,
            NULLIF(:svg_height, 0)  AS svg_height,
            :sort_order AS sort_order,
            CURRENT_TIMESTAMP() AS created_at
        ) AS s
        ON t.plant_id = s.plant_id AND t.floor_id = s.floor_id
        WHEN MATCHED THEN UPDATE SET
            floor_name = s.floor_name,
            svg_url    = s.svg_url,
            svg_width  = s.svg_width,
            svg_height = s.svg_height,
            sort_order = s.sort_order
        WHEN NOT MATCHED THEN INSERT (plant_id, floor_id, floor_name, svg_url, svg_width, svg_height, sort_order, created_at)
            VALUES (s.plant_id, s.floor_id, s.floor_name, s.svg_url, s.svg_width, s.svg_height, s.sort_order, s.created_at)
    """
    await run_sql_async(token, sql, params)


async def delete_floor(token: str, plant_id: str, floor_id: str) -> None:
    """Remove a floor definition from em_plant_floor."""
    params = [sql_param("plant_id", plant_id), sql_param("floor_id", floor_id)]
    sql = f"DELETE FROM {FLOOR_TBL} WHERE plant_id = :plant_id AND floor_id = :floor_id"
    await run_sql_async(token, sql, params)
