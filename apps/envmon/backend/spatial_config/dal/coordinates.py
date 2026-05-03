"""DAL — location coordinate reads and admin writes to em_location_coordinates."""

from backend.utils.db import run_sql_async, sql_param
from backend.utils.em_config import (
    COORD_TBL,
    INSP_TYPES_SQL,
    LOT_TBL,
    POINT_TBL,
)


async def fetch_unmapped_locations(token: str, plant_id: str) -> list[dict]:
    """Return functional locations that have inspection history but no coordinate mapping."""
    params = [sql_param("plant_id", plant_id)]
    sql = f"""
        WITH active_locs AS (
            SELECT DISTINCT ip.FUNCTIONAL_LOCATION AS func_loc_id
            FROM {LOT_TBL} lot
            JOIN {POINT_TBL} ip ON lot.INSPECTION_LOT_ID = ip.INSPECTION_LOT_ID
            WHERE lot.PLANT_ID         = :plant_id
              AND lot.INSPECTION_TYPE IN {INSP_TYPES_SQL}
              AND ip.FUNCTIONAL_LOCATION IS NOT NULL
        )
        SELECT al.func_loc_id
        FROM active_locs al
        LEFT JOIN {COORD_TBL} c
            ON al.func_loc_id = c.func_loc_id
           AND c.plant_id     = :plant_id
        WHERE c.func_loc_id IS NULL
        ORDER BY al.func_loc_id
    """
    return await run_sql_async(token, sql, params)


async def fetch_mapped_locations(token: str, plant_id: str) -> list[dict]:
    """Return all coordinate-mapped locations for a plant."""
    params = [sql_param("plant_id", plant_id)]
    sql = f"""
        SELECT func_loc_id, floor_id, x_pos, y_pos
        FROM {COORD_TBL}
        WHERE plant_id = :plant_id
        ORDER BY floor_id, func_loc_id
    """
    return await run_sql_async(token, sql, params)


async def fetch_location_coordinate(
    token: str,
    plant_id: str,
    func_loc_id: str,
) -> list[dict]:
    """Return coordinate row for a single location, or empty list if unmapped."""
    params = [
        sql_param("func_loc_id", func_loc_id),
        sql_param("plant_id",    plant_id),
    ]
    sql = f"""
        SELECT func_loc_id, floor_id, x_pos, y_pos
        FROM {COORD_TBL}
        WHERE func_loc_id = :func_loc_id AND plant_id = :plant_id
    """
    return await run_sql_async(token, sql, params)


async def fetch_locations(
    token: str,
    plant_id: str,
    floor_id: str | None,
    mapped_only: bool,
) -> list[dict]:
    """Return all known functional locations for a plant with optional floor/mapping filters."""
    params = [sql_param("plant_id", plant_id)]

    floor_filter = ""
    if floor_id:
        params.append(sql_param("floor_id", floor_id))
        floor_filter = "AND c.floor_id = :floor_id"

    mapped_filter = "WHERE c.func_loc_id IS NOT NULL" if mapped_only else ""

    sql = f"""
        WITH known_locs AS (
            SELECT DISTINCT ip.FUNCTIONAL_LOCATION AS func_loc_id
            FROM {LOT_TBL} lot
            JOIN {POINT_TBL} ip ON lot.INSPECTION_LOT_ID = ip.INSPECTION_LOT_ID
            WHERE lot.PLANT_ID = :plant_id
              AND lot.INSPECTION_TYPE IN {INSP_TYPES_SQL}
              AND ip.FUNCTIONAL_LOCATION IS NOT NULL
        )
        SELECT
            kl.func_loc_id,
            c.floor_id,
            c.x_pos,
            c.y_pos,
            CASE WHEN c.func_loc_id IS NOT NULL THEN TRUE ELSE FALSE END AS is_mapped
        FROM known_locs kl
        LEFT JOIN {COORD_TBL} c
            ON kl.func_loc_id = c.func_loc_id
           AND c.plant_id = :plant_id
           {floor_filter}
        {mapped_filter}
        ORDER BY kl.func_loc_id
    """
    return await run_sql_async(token, sql, params)


async def upsert_coordinate(
    token: str,
    plant_id: str,
    func_loc_id: str,
    floor_id: str,
    x_pos: float,
    y_pos: float,
) -> None:
    """Upsert a coordinate mapping into em_location_coordinates."""
    params = [
        sql_param("plant_id",    plant_id),
        sql_param("func_loc_id", func_loc_id),
        sql_param("floor_id",    floor_id),
        sql_param("x_pos",       x_pos),
        sql_param("y_pos",       y_pos),
    ]
    sql = f"""
        MERGE INTO {COORD_TBL} AS target
        USING (
            SELECT
                :plant_id               AS plant_id,
                :func_loc_id            AS func_loc_id,
                :floor_id               AS floor_id,
                CAST(:x_pos AS DOUBLE)  AS x_pos,
                CAST(:y_pos AS DOUBLE)  AS y_pos
        ) AS source
        ON target.func_loc_id = source.func_loc_id
       AND target.plant_id    = source.plant_id
        WHEN MATCHED THEN UPDATE SET
            target.floor_id   = source.floor_id,
            target.x_pos      = source.x_pos,
            target.y_pos      = source.y_pos,
            target.updated_by = CURRENT_USER(),
            target.updated_at = CURRENT_TIMESTAMP()
        WHEN NOT MATCHED THEN INSERT (
            plant_id, func_loc_id, floor_id, x_pos, y_pos, updated_by, updated_at
        ) VALUES (
            source.plant_id, source.func_loc_id, source.floor_id,
            source.x_pos, source.y_pos, CURRENT_USER(), CURRENT_TIMESTAMP()
        )
    """
    await run_sql_async(token, sql, params)


async def delete_coordinate(token: str, plant_id: str, func_loc_id: str) -> None:
    """Remove a coordinate mapping from em_location_coordinates."""
    params = [sql_param("func_loc_id", func_loc_id), sql_param("plant_id", plant_id)]
    sql = f"DELETE FROM {COORD_TBL} WHERE func_loc_id = :func_loc_id AND plant_id = :plant_id"
    await run_sql_async(token, sql, params)
