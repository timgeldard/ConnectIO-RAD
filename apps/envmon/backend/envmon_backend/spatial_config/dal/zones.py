"""DAL — zone reads and admin writes to em_location_zones."""

from envmon_backend.utils.db import run_sql_async, sql_param
from envmon_backend.utils.em_config import ZONE_TBL


async def fetch_zones(
    token: str,
    plant_id: str,
    floor_id: str,
    revision_id: str,
) -> list[dict]:
    """Return all zones for a given plant, floor, and revision.

    Args:
        token: Databricks access token from the request proxy header.
        plant_id: SAP plant code to filter by.
        floor_id: Floor identifier to filter by.
        revision_id: Revision UUID to filter by.

    Returns:
        List of zone row dicts ordered by zone_name.
    """
    params = [
        sql_param("plant_id",    plant_id),
        sql_param("floor_id",    floor_id),
        sql_param("revision_id", revision_id),
    ]
    sql = f"""
        SELECT
            zone_id, plant_id, floor_id, functional_location_id, functional_location_level,
            zone_name, geometry_type, geometry_json, bbox_json, centroid_x, centroid_y,
            parent_zone_id, revision_id, status, created_by, created_at, updated_by, updated_at
        FROM {ZONE_TBL}
        WHERE plant_id    = :plant_id
          AND floor_id    = :floor_id
          AND revision_id = :revision_id
        ORDER BY zone_name
    """
    return await run_sql_async(token, sql, params)


async def fetch_zone(token: str, zone_id: str) -> list[dict]:
    """Return a single zone row by its UUID, or an empty list if not found.

    Args:
        token: Databricks access token.
        zone_id: UUID of the zone to retrieve.

    Returns:
        List containing at most one zone row dict.
    """
    params = [sql_param("zone_id", zone_id)]
    sql = f"""
        SELECT
            zone_id, plant_id, floor_id, functional_location_id, functional_location_level,
            zone_name, geometry_type, geometry_json, bbox_json, centroid_x, centroid_y,
            parent_zone_id, revision_id, status, created_by, created_at, updated_by, updated_at
        FROM {ZONE_TBL}
        WHERE zone_id = :zone_id
    """
    return await run_sql_async(token, sql, params)


async def upsert_zone(
    token: str,
    zone_id: str,
    plant_id: str,
    floor_id: str,
    func_loc_id: str | None,
    zone_name: str,
    geometry_type: str,
    geometry_json: str,
    bbox_json: str | None,
    centroid_x: float | None,
    centroid_y: float | None,
    revision_id: str,
) -> None:
    """Insert or update a zone in em_location_zones.

    Matches on zone_id. On insert, sets status to 'draft' and records created_by/at.
    On update, only zone_name, geometry, bbox, centroid, and updated_by/at are changed.

    Args:
        token: Databricks access token.
        zone_id: UUID identifying the zone.
        plant_id: SAP plant code.
        floor_id: Floor identifier.
        func_loc_id: SAP L4 functional location code; may be None.
        zone_name: Human-readable zone label.
        geometry_type: ``'polygon'`` or ``'rectangle'``.
        geometry_json: Canonical geometry as a JSON string.
        bbox_json: Bounding box as a JSON string; may be None.
        centroid_x: Zone centroid x in percentage coordinates; may be None.
        centroid_y: Zone centroid y in percentage coordinates; may be None.
        revision_id: UUID of the owning layout revision.
    """
    params = [
        sql_param("zone_id",       zone_id),
        sql_param("plant_id",      plant_id),
        sql_param("floor_id",      floor_id),
        sql_param("func_loc_id",   func_loc_id),
        sql_param("zone_name",     zone_name),
        sql_param("geometry_type", geometry_type),
        sql_param("geometry_json", geometry_json),
        sql_param("bbox_json",     bbox_json),
        sql_param("centroid_x",    centroid_x),
        sql_param("centroid_y",    centroid_y),
        sql_param("revision_id",   revision_id),
    ]
    sql = f"""
        MERGE INTO {ZONE_TBL} AS target
        USING (
            SELECT
                :zone_id                        AS zone_id,
                :plant_id                       AS plant_id,
                :floor_id                       AS floor_id,
                :func_loc_id                    AS functional_location_id,
                :zone_name                      AS zone_name,
                :geometry_type                  AS geometry_type,
                :geometry_json                  AS geometry_json,
                :bbox_json                      AS bbox_json,
                CAST(:centroid_x AS DOUBLE)     AS centroid_x,
                CAST(:centroid_y AS DOUBLE)     AS centroid_y,
                :revision_id                    AS revision_id
        ) AS source
        ON target.zone_id = source.zone_id
        WHEN MATCHED THEN UPDATE SET
            target.functional_location_id = source.functional_location_id,
            target.zone_name              = source.zone_name,
            target.geometry_type          = source.geometry_type,
            target.geometry_json          = source.geometry_json,
            target.bbox_json              = source.bbox_json,
            target.centroid_x             = source.centroid_x,
            target.centroid_y             = source.centroid_y,
            target.updated_by             = CURRENT_USER(),
            target.updated_at             = CURRENT_TIMESTAMP()
        WHEN NOT MATCHED THEN INSERT (
            zone_id, plant_id, floor_id, functional_location_id, zone_name,
            geometry_type, geometry_json, bbox_json, centroid_x, centroid_y,
            revision_id, status, created_by, created_at, updated_by, updated_at
        ) VALUES (
            source.zone_id, source.plant_id, source.floor_id, source.functional_location_id,
            source.zone_name, source.geometry_type, source.geometry_json,
            source.bbox_json, source.centroid_x, source.centroid_y,
            source.revision_id, 'draft', CURRENT_USER(), CURRENT_TIMESTAMP(),
            CURRENT_USER(), CURRENT_TIMESTAMP()
        )
    """
    await run_sql_async(token, sql, params)


async def delete_draft_zone(token: str, zone_id: str, revision_id: str) -> None:
    """Delete a zone only if it belongs to a draft revision.

    The revision_id guard prevents accidental deletion of published zone records.

    Args:
        token: Databricks access token.
        zone_id: UUID of the zone to delete.
        revision_id: Revision UUID — the DELETE is a no-op if this revision is not draft.
    """
    params = [
        sql_param("zone_id",     zone_id),
        sql_param("revision_id", revision_id),
    ]
    sql = f"""
        DELETE FROM {ZONE_TBL}
        WHERE zone_id     = :zone_id
          AND revision_id = :revision_id
          AND status      = 'draft'
    """
    await run_sql_async(token, sql, params)


async def archive_zones_for_revision(token: str, revision_id: str) -> None:
    """Mark all draft zones for a revision as archived.

    Called during the publish workflow to transition the superseded revision's
    zones to 'archived' so they no longer appear in active studio queries.

    Args:
        token: Databricks access token.
        revision_id: UUID of the revision whose draft zones to archive.
    """
    params = [sql_param("revision_id", revision_id)]
    sql = f"""
        UPDATE {ZONE_TBL}
        SET
            status     = 'archived',
            updated_by = CURRENT_USER(),
            updated_at = CURRENT_TIMESTAMP()
        WHERE revision_id = :revision_id
          AND status      = 'draft'
    """
    await run_sql_async(token, sql, params)
