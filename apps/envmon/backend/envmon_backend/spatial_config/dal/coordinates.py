"""DAL — location coordinate reads and admin writes to em_location_coordinates."""

from envmon_backend.utils.db import run_sql_async, sql_param
from envmon_backend.utils.em_config import (
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


async def fetch_studio_coordinates(token: str, plant_id: str, floor_id: str) -> list[dict]:
    """Return all coordinate-mapped locations for a plant/floor including Slice-1 zone columns.

    Includes ``parent_zone_id``, ``placement_source``, ``revision_id``, and
    ``validation_status`` added by migration 007. Used by the layout validation
    and publish workflows.

    Args:
        token: Databricks access token.
        plant_id: SAP plant code to filter by.
        floor_id: Floor identifier to filter by.

    Returns:
        List of coordinate row dicts ordered by func_loc_id.
    """
    params = [
        sql_param("plant_id", plant_id),
        sql_param("floor_id", floor_id),
    ]
    sql = f"""
        SELECT
            func_loc_id, floor_id, x_pos, y_pos,
            parent_zone_id, placement_source, revision_id,
            validation_status, validation_messages_json
        FROM {COORD_TBL}
        WHERE plant_id = :plant_id
          AND floor_id = :floor_id
        ORDER BY func_loc_id
    """
    return await run_sql_async(token, sql, params)


async def update_coordinate_zone_assignment(
    token: str,
    plant_id: str,
    func_loc_id: str,
    parent_zone_id: str | None,
    revision_id: str | None,
    placement_source: str,
    validation_status: str,
    validation_messages_json: str | None,
) -> None:
    """Update zone assignment and validation metadata for a coordinate row.

    Called by the publish workflow to stamp each coordinate with its zone
    assignment and validation outcome from the draft revision being published.

    Args:
        token: Databricks access token.
        plant_id: SAP plant code.
        func_loc_id: Functional location identifier.
        parent_zone_id: UUID of the L4 zone, or None if unassigned.
        revision_id: UUID of the published revision, or None.
        placement_source: How the coordinate was placed (e.g. ``'manual'``).
        validation_status: ``'ok'``, ``'warning'``, or ``'error'``.
        validation_messages_json: JSON array of issue descriptions, or None.
    """
    params = [
        sql_param("plant_id",                  plant_id),
        sql_param("func_loc_id",               func_loc_id),
        sql_param("parent_zone_id",            parent_zone_id),
        sql_param("revision_id",               revision_id),
        sql_param("placement_source",          placement_source),
        sql_param("validation_status",         validation_status),
        sql_param("validation_messages_json",  validation_messages_json),
    ]
    sql = f"""
        UPDATE {COORD_TBL}
        SET
            parent_zone_id           = :parent_zone_id,
            revision_id              = :revision_id,
            placement_source         = :placement_source,
            validation_status        = :validation_status,
            validation_messages_json = :validation_messages_json,
            updated_by               = CURRENT_USER(),
            updated_at               = CURRENT_TIMESTAMP()
        WHERE plant_id    = :plant_id
          AND func_loc_id = :func_loc_id
    """
    await run_sql_async(token, sql, params)
