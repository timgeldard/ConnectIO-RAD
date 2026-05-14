"""DAL — revision reads and lifecycle writes to em_layout_revision."""

from envmon_backend.utils.db import run_sql_async, sql_param
from envmon_backend.utils.em_config import FLOOR_TBL, REVISION_TBL


async def fetch_revision(token: str, revision_id: str) -> list[dict]:
    """Return a single revision row by its UUID, or an empty list if not found.

    Args:
        token: Databricks access token.
        revision_id: UUID of the revision to retrieve.

    Returns:
        List containing at most one revision row dict.
    """
    params = [sql_param("revision_id", revision_id)]
    sql = f"""
        SELECT
            revision_id, plant_id, floor_id, revision_number, state,
            base_revision_id, change_reason, publish_summary_json, validation_summary_json,
            created_by, created_at, published_by, published_at, rolled_back_from_revision_id
        FROM {REVISION_TBL}
        WHERE revision_id = :revision_id
    """
    return await run_sql_async(token, sql, params)


async def fetch_revisions(
    token: str,
    plant_id: str,
    floor_id: str,
    limit: int = 20,
) -> list[dict]:
    """Return the most recent revisions for a plant/floor, newest first.

    Args:
        token: Databricks access token.
        plant_id: SAP plant code to filter by.
        floor_id: Floor identifier to filter by.
        limit: Maximum number of rows to return (default 20).

    Returns:
        List of revision row dicts ordered by revision_number DESC.
    """
    params = [
        sql_param("plant_id", plant_id),
        sql_param("floor_id", floor_id),
        sql_param("limit",    limit),
    ]
    sql = f"""
        SELECT
            revision_id, plant_id, floor_id, revision_number, state,
            base_revision_id, change_reason, publish_summary_json, validation_summary_json,
            created_by, created_at, published_by, published_at, rolled_back_from_revision_id
        FROM {REVISION_TBL}
        WHERE plant_id = :plant_id
          AND floor_id = :floor_id
        ORDER BY revision_number DESC
        LIMIT :limit
    """
    return await run_sql_async(token, sql, params)


async def fetch_active_revision(token: str, plant_id: str, floor_id: str) -> list[dict]:
    """Return the currently published revision for a plant/floor.

    There should be at most one published revision at any time. If the floor has
    never been published through Studio this returns an empty list.

    Args:
        token: Databricks access token.
        plant_id: SAP plant code.
        floor_id: Floor identifier.

    Returns:
        List containing at most one published revision row dict.
    """
    params = [
        sql_param("plant_id", plant_id),
        sql_param("floor_id", floor_id),
    ]
    sql = f"""
        SELECT
            revision_id, plant_id, floor_id, revision_number, state,
            base_revision_id, change_reason, publish_summary_json, validation_summary_json,
            created_by, created_at, published_by, published_at, rolled_back_from_revision_id
        FROM {REVISION_TBL}
        WHERE plant_id = :plant_id
          AND floor_id = :floor_id
          AND state    = 'published'
        ORDER BY revision_number DESC
        LIMIT 1
    """
    return await run_sql_async(token, sql, params)


async def fetch_draft_revision(token: str, plant_id: str, floor_id: str) -> list[dict]:
    """Return the open draft revision for a plant/floor, if one exists.

    Each floor can have at most one open draft. If no draft exists (first use or
    after abandoning) this returns an empty list.

    Args:
        token: Databricks access token.
        plant_id: SAP plant code.
        floor_id: Floor identifier.

    Returns:
        List containing at most one draft revision row dict.
    """
    params = [
        sql_param("plant_id", plant_id),
        sql_param("floor_id", floor_id),
    ]
    sql = f"""
        SELECT
            revision_id, plant_id, floor_id, revision_number, state,
            base_revision_id, change_reason, publish_summary_json, validation_summary_json,
            created_by, created_at, published_by, published_at, rolled_back_from_revision_id
        FROM {REVISION_TBL}
        WHERE plant_id = :plant_id
          AND floor_id = :floor_id
          AND state    = 'draft'
        ORDER BY revision_number DESC
        LIMIT 1
    """
    return await run_sql_async(token, sql, params)


async def create_revision(
    token: str,
    revision_id: str,
    plant_id: str,
    floor_id: str,
    revision_number: int,
    created_by: str,
    base_revision_id: str | None,
) -> None:
    """Insert a new draft revision row into em_layout_revision.

    Uses ``INSERT INTO ... SELECT ... WHERE NOT EXISTS`` so that at most one
    draft can exist per floor even under concurrent requests. Delta Lake
    transactions make this insert atomic — a second concurrent call racing
    on the same (plant_id, floor_id) pair will insert zero rows and the
    caller's subsequent ``fetch_draft_revision`` will return the winner's row.

    Args:
        token: Databricks access token.
        revision_id: UUID for the new revision.
        plant_id: SAP plant code.
        floor_id: Floor identifier.
        revision_number: Next revision number for this floor (must be unique).
        created_by: Identity creating this revision.
        base_revision_id: UUID of the revision this drafts from; None for first revision.
    """
    params = [
        sql_param("revision_id",      revision_id),
        sql_param("plant_id",         plant_id),
        sql_param("floor_id",         floor_id),
        sql_param("revision_number",  revision_number),
        sql_param("created_by",       created_by),
        sql_param("base_revision_id", base_revision_id),
    ]
    sql = f"""
        INSERT INTO {REVISION_TBL} (
            revision_id, plant_id, floor_id, revision_number, state,
            base_revision_id, created_by, created_at
        )
        SELECT
            :revision_id, :plant_id, :floor_id, :revision_number, 'draft',
            :base_revision_id, :created_by, CURRENT_TIMESTAMP()
        WHERE NOT EXISTS (
            SELECT 1 FROM {REVISION_TBL}
            WHERE plant_id = :plant_id
              AND floor_id = :floor_id
              AND state    = 'draft'
        )
    """
    await run_sql_async(token, sql, params)


async def update_revision_state(
    token: str,
    revision_id: str,
    state: str,
    published_by: str | None,
    published_at: str | None,
    change_reason: str | None,
    publish_summary_json: str | None,
    validation_summary_json: str | None,
) -> None:
    """Update the lifecycle state and optional publish metadata for a revision.

    Used by the publish workflow to transition state and record who published
    and why. Also used to mark a revision as superseded or rolled_back.

    Args:
        token: Databricks access token.
        revision_id: UUID of the revision to update.
        state: New state value ('published', 'superseded', or 'rolled_back').
        published_by: Identity that triggered the state change; None if not publishing.
        published_at: ISO 8601 timestamp string of publish event; None if not publishing.
        change_reason: Human-readable reason; required when state='published'.
        publish_summary_json: JSON string with zone/point/warning counts; may be None.
        validation_summary_json: JSON string with last validation result; may be None.
    """
    params = [
        sql_param("revision_id",             revision_id),
        sql_param("state",                   state),
        sql_param("published_by",            published_by),
        sql_param("published_at",            published_at),
        sql_param("change_reason",           change_reason),
        sql_param("publish_summary_json",    publish_summary_json),
        sql_param("validation_summary_json", validation_summary_json),
    ]
    sql = f"""
        UPDATE {REVISION_TBL}
        SET
            state                   = :state,
            published_by            = :published_by,
            published_at            = CAST(:published_at AS TIMESTAMP),
            change_reason           = :change_reason,
            publish_summary_json    = :publish_summary_json,
            validation_summary_json = :validation_summary_json
        WHERE revision_id = :revision_id
    """
    await run_sql_async(token, sql, params)


async def supersede_active_revision(token: str, plant_id: str, floor_id: str) -> None:
    """Transition the current published revision to 'superseded'.

    Called immediately before publishing a new revision so only one revision
    per floor carries state='published' at any time. Also clears active_revision_id
    on the floor row (the caller then sets it to the new revision_id).

    Args:
        token: Databricks access token.
        plant_id: SAP plant code.
        floor_id: Floor identifier.
    """
    params = [
        sql_param("plant_id", plant_id),
        sql_param("floor_id", floor_id),
    ]
    supersede_sql = f"""
        UPDATE {REVISION_TBL}
        SET state = 'superseded'
        WHERE plant_id = :plant_id
          AND floor_id = :floor_id
          AND state    = 'published'
    """
    clear_floor_sql = f"""
        UPDATE {FLOOR_TBL}
        SET active_revision_id = NULL
        WHERE plant_id = :plant_id
          AND floor_id = :floor_id
    """
    await run_sql_async(token, supersede_sql, params)
    await run_sql_async(token, clear_floor_sql, params)


async def set_active_revision(token: str, plant_id: str, floor_id: str, revision_id: str) -> None:
    """Set active_revision_id on the floor row after a successful publish.

    Args:
        token: Databricks access token.
        plant_id: SAP plant code.
        floor_id: Floor identifier.
        revision_id: UUID of the newly published revision.
    """
    params = [
        sql_param("plant_id",    plant_id),
        sql_param("floor_id",    floor_id),
        sql_param("revision_id", revision_id),
    ]
    sql = f"""
        UPDATE {FLOOR_TBL}
        SET active_revision_id = :revision_id
        WHERE plant_id = :plant_id
          AND floor_id = :floor_id
    """
    await run_sql_async(token, sql, params)
