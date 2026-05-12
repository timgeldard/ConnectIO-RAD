"""SQL data-access layer for composable dashboards.

All reads use ``run_sql_async`` (300 s TTL cache via shared_db).
All writes use ``run_sql`` (synchronous, never cached) so that list/get
responses reflect mutations immediately after cache expiry.

Table references use ``_dtbl()`` which reads ``DASHBOARD_CATALOG`` and
``DASHBOARD_SCHEMA`` from environment variables at call time, raising HTTP 500
when the catalog var is absent (misconfigured deployment).
"""
from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException
from shared_db.core import run_sql, run_sql_async, sql_param


def _dtbl(name: str) -> str:
    """Return a fully-qualified backtick-quoted table reference for dashboard tables.

    Reads ``DASHBOARD_CATALOG`` and ``DASHBOARD_SCHEMA`` from the environment.
    ``DASHBOARD_SCHEMA`` defaults to ``"dashboards"`` when unset.

    Args:
        name: Bare table name (e.g. ``"dashboard_definitions"``).

    Returns:
        Backtick-quoted three-part identifier suitable for Databricks SQL.

    Raises:
        HTTPException: 500 when ``DASHBOARD_CATALOG`` is not set.
    """
    catalog = os.environ.get("DASHBOARD_CATALOG", "")
    schema = os.environ.get("DASHBOARD_SCHEMA", "dashboards")
    if not catalog:
        raise HTTPException(
            status_code=500,
            detail="DASHBOARD_CATALOG environment variable is not set.",
        )
    return f"`{catalog}`.`{schema}`.`{name}`"


async def list_dashboards(
    token: str,
    email: str,
    *,
    owned_by_me: bool = False,
    shared_with_me: bool = False,
    search: Optional[str] = None,
) -> list[dict]:
    """Return all dashboards visible to the user, ordered by most-recently-updated.

    Visibility rules (applied in priority order when both flags are False):
    - User is the owner, OR
    - Dashboard is public, OR
    - Dashboard has an explicit share row for this user.

    When ``owned_by_me`` is True only owned dashboards are returned.
    When ``shared_with_me`` is True only explicitly-shared dashboards are returned.

    Args:
        token: Databricks access token forwarded from the request proxy.
        email: Email of the requesting user (used for ownership and share checks).
        owned_by_me: When True restrict to dashboards owned by ``email``.
        shared_with_me: When True restrict to dashboards with a share row for ``email``.
        search: Optional case-insensitive substring filter on title or description.

    Returns:
        List of row dicts with keys matching ``DashboardSummary``.
    """
    # Validate env vars before building the query.
    definitions = _dtbl("dashboard_definitions")
    versions = _dtbl("dashboard_versions")
    shares = _dtbl("dashboard_shares")

    if owned_by_me:
        visibility_clause = "d.owner_email = :email"
    elif shared_with_me:
        visibility_clause = "s.dashboard_id IS NOT NULL"
    else:
        visibility_clause = "(d.owner_email = :email OR d.is_public = true OR s.dashboard_id IS NOT NULL)"

    params: list[dict] = [sql_param("email", email)]

    search_clause = ""
    if search:
        search_clause = (
            "AND (LOWER(d.title) LIKE LOWER(:search)"
            " OR LOWER(COALESCE(d.description, '')) LIKE LOWER(:search))"
        )
        params.append(sql_param("search", f"%{search}%"))

    query = f"""
        SELECT
            d.id,
            d.title,
            d.description,
            d.owner_email,
            d.is_public,
            d.tags,
            d.created_at,
            d.updated_at,
            COALESCE(v.version_num, 1) AS version
        FROM {definitions} d
        LEFT JOIN {versions} v
            ON v.id = d.current_version_id
        LEFT JOIN {shares} s
            ON s.dashboard_id = d.id AND s.shared_with_email = :email
        WHERE d.is_deleted = false
          AND {visibility_clause}
          {search_clause}
        ORDER BY d.updated_at DESC
        LIMIT 200
    """
    return await run_sql_async(token, query, params, endpoint_hint="platform.dashboards.list")


async def get_dashboard(
    token: str,
    dashboard_id: str,
    email: str,
) -> Optional[dict]:
    """Return the full dashboard row including ``config_json`` for the given ID.

    Enforces the same visibility rules as ``list_dashboards``.

    Args:
        token: Databricks access token.
        dashboard_id: UUID of the dashboard to fetch.
        email: Email of the requesting user.

    Returns:
        Row dict with ``DashboardDetail`` fields plus ``config_json``,
        or ``None`` when no visible dashboard matches the ID.
    """
    definitions = _dtbl("dashboard_definitions")
    versions = _dtbl("dashboard_versions")
    shares = _dtbl("dashboard_shares")

    query = f"""
        SELECT
            d.id,
            d.title,
            d.description,
            d.owner_email,
            d.is_public,
            d.tags,
            d.created_at,
            d.updated_at,
            COALESCE(v.version_num, 1) AS version,
            v.config_json
        FROM {definitions} d
        LEFT JOIN {versions} v
            ON v.id = d.current_version_id
        LEFT JOIN {shares} s
            ON s.dashboard_id = d.id AND s.shared_with_email = :email
        WHERE d.id = :dashboard_id
          AND d.is_deleted = false
          AND (d.owner_email = :email OR d.is_public = true OR s.dashboard_id IS NOT NULL)
    """
    rows = await run_sql_async(
        token,
        query,
        [sql_param("dashboard_id", dashboard_id), sql_param("email", email)],
        endpoint_hint="platform.dashboards.get",
    )
    return rows[0] if rows else None


def create_dashboard(
    token: str,
    *,
    title: str,
    description: Optional[str],
    config_json: str,
    owner_email: str,
    is_public: bool,
    tags: list[str],
) -> dict:
    """Insert a new dashboard definition and its first version row.

    Two sequential ``run_sql`` calls (synchronous, no cache):
    1. INSERT into ``dashboard_versions`` — creates the initial config snapshot.
    2. INSERT into ``dashboard_definitions`` — creates the metadata record
       pointing to that version.

    The two-step write is not atomic. An orphan version row is harmless —
    it has no corresponding definition and will never appear in queries.

    Args:
        token: Databricks access token.
        title: Dashboard display title.
        description: Optional long description.
        config_json: Full ``ComposableDashboardConfig`` serialised as JSON.
        owner_email: Email of the creating user.
        is_public: When True any authenticated user can view the dashboard.
        tags: List of string tags for filtering.

    Returns:
        Row dict equivalent to a ``DashboardDetail`` (includes ``config_json``).
    """
    now = datetime.now(timezone.utc).isoformat()
    dash_id = str(uuid.uuid4())
    version_id = str(uuid.uuid4())
    tags_json = json.dumps(tags)

    definitions = _dtbl("dashboard_definitions")
    versions = _dtbl("dashboard_versions")

    run_sql(
        token,
        f"""
        INSERT INTO {versions}
            (id, dashboard_id, version_num, config_json, created_at, created_by_email)
        VALUES
            (:version_id, :dashboard_id, 1, :config_json, :now, :owner_email)
        """,
        [
            sql_param("version_id", version_id),
            sql_param("dashboard_id", dash_id),
            sql_param("config_json", config_json),
            sql_param("now", now),
            sql_param("owner_email", owner_email),
        ],
        endpoint_hint="platform.dashboards.create_version",
    )

    run_sql(
        token,
        f"""
        INSERT INTO {definitions}
            (id, title, description, owner_email, is_public, tags,
             current_version_id, is_deleted, created_at, updated_at)
        VALUES
            (:dashboard_id, :title, :description, :owner_email, :is_public,
             :tags_json, :version_id, false, :now, :now)
        """,
        [
            sql_param("dashboard_id", dash_id),
            sql_param("title", title),
            sql_param("description", description),
            sql_param("owner_email", owner_email),
            sql_param("is_public", is_public),
            sql_param("tags_json", tags_json),
            sql_param("version_id", version_id),
            sql_param("now", now),
        ],
        endpoint_hint="platform.dashboards.create_definition",
    )

    return {
        "id": dash_id,
        "title": title,
        "description": description,
        "owner_email": owner_email,
        "is_public": is_public,
        "tags": tags,
        "version": 1,
        "config_json": config_json,
        "created_at": now,
        "updated_at": now,
    }


def update_dashboard(
    token: str,
    dashboard_id: str,
    email: str,
    *,
    title: Optional[str],
    description: Optional[str],
    config_json: str,
    is_public: Optional[bool],
    tags: Optional[list[str]],
) -> Optional[dict]:
    """Append a new config version and update the dashboard definition metadata.

    Three sequential ``run_sql`` calls (synchronous, no cache):
    1. SELECT — verify the dashboard exists and ``email`` is the owner; also reads
       the current ``version_num`` so the new version can be numbered correctly.
    2. INSERT into ``dashboard_versions`` — stores the new config snapshot.
    3. UPDATE ``dashboard_definitions`` — points ``current_version_id`` to the new
       version and patches any metadata fields supplied by the caller.

    The three-step write is not atomic. A partial failure leaves an orphan version
    row or a stale ``current_version_id``. Both are recoverable by retrying the
    full PUT — acceptable for MVP.

    Args:
        token: Databricks access token.
        dashboard_id: UUID of the dashboard to update.
        email: Email of the requesting user; must match ``owner_email``.
        title: New title (``None`` keeps the existing value).
        description: New description (``None`` keeps the existing value).
        config_json: Full ``ComposableDashboardConfig`` serialised as JSON.
        is_public: New visibility flag (``None`` keeps the existing value).
        tags: New tag list (``None`` keeps the existing value).

    Returns:
        Row dict equivalent to a ``DashboardDetail`` (includes ``config_json``),
        or ``None`` when the dashboard does not exist, is deleted, or ``email``
        is not the owner.
    """
    definitions = _dtbl("dashboard_definitions")
    versions = _dtbl("dashboard_versions")

    # Step 1: Confirm existence, ownership, and current version number.
    rows = run_sql(
        token,
        f"""
        SELECT
            d.title,
            d.description,
            d.owner_email,
            d.is_public,
            d.tags,
            d.created_at,
            COALESCE(v.version_num, 0) AS current_version_num
        FROM {definitions} d
        LEFT JOIN {versions} v ON v.id = d.current_version_id
        WHERE d.id = :dashboard_id
          AND d.is_deleted = false
        """,
        [sql_param("dashboard_id", dashboard_id)],
        endpoint_hint="platform.dashboards.update_check",
    )
    if not rows:
        return None
    existing = rows[0]
    if existing["owner_email"] != email:
        return None

    # Step 2: Insert a new version snapshot.
    now = datetime.now(timezone.utc).isoformat()
    version_id = str(uuid.uuid4())
    next_version_num = int(existing["current_version_num"]) + 1

    run_sql(
        token,
        f"""
        INSERT INTO {versions}
            (id, dashboard_id, version_num, config_json, created_at, created_by_email)
        VALUES
            (:version_id, :dashboard_id, :version_num, :config_json, :now, :email)
        """,
        [
            sql_param("version_id", version_id),
            sql_param("dashboard_id", dashboard_id),
            sql_param("version_num", next_version_num),
            sql_param("config_json", config_json),
            sql_param("now", now),
            sql_param("email", email),
        ],
        endpoint_hint="platform.dashboards.update_version",
    )

    # Resolve final metadata values (None → keep existing).
    new_title = title if title is not None else existing["title"]
    new_description = description if description is not None else existing.get("description")
    new_is_public = is_public if is_public is not None else bool(existing.get("is_public"))

    if tags is not None:
        new_tags: list[str] = tags
    else:
        raw = existing.get("tags")
        if isinstance(raw, list):
            new_tags = [str(t) for t in raw]
        elif isinstance(raw, str):
            try:
                new_tags = json.loads(raw)
            except (ValueError, TypeError):
                new_tags = []
        else:
            new_tags = []

    # Step 3: Update the definition record to point at the new version.
    run_sql(
        token,
        f"""
        UPDATE {definitions}
        SET current_version_id = :version_id,
            title              = :title,
            description        = :description,
            is_public          = :is_public,
            tags               = :tags_json,
            updated_at         = :now
        WHERE id = :dashboard_id
        """,
        [
            sql_param("version_id", version_id),
            sql_param("title", new_title),
            sql_param("description", new_description),
            sql_param("is_public", new_is_public),
            sql_param("tags_json", json.dumps(new_tags)),
            sql_param("now", now),
            sql_param("dashboard_id", dashboard_id),
        ],
        endpoint_hint="platform.dashboards.update_definition",
    )

    return {
        "id": dashboard_id,
        "title": new_title,
        "description": new_description,
        "owner_email": existing["owner_email"],
        "is_public": new_is_public,
        "tags": new_tags,
        "version": next_version_num,
        "config_json": config_json,
        "created_at": str(existing["created_at"]),
        "updated_at": now,
    }


def list_shares(token: str, dashboard_id: str, owner_email: str) -> list[dict]:
    """Return all explicit share rows for a dashboard, ordered by share date.

    Only the dashboard owner may call this; ownership is verified in the query so
    an unauthorised caller receives an empty list (information not leaked).

    Args:
        token: Databricks access token.
        dashboard_id: UUID of the dashboard whose shares to fetch.
        owner_email: Email of the requesting user; must be the dashboard owner.

    Returns:
        List of row dicts with keys ``dashboard_id``, ``shared_with_email``,
        ``shared_by_email``, ``shared_at``. Empty when the dashboard does not
        exist, is deleted, or the caller is not the owner.
    """
    definitions = _dtbl("dashboard_definitions")
    shares = _dtbl("dashboard_shares")

    return run_sql(
        token,
        f"""
        SELECT
            s.dashboard_id,
            s.shared_with_email,
            s.shared_by_email,
            s.shared_at
        FROM {shares} s
        JOIN {definitions} d ON d.id = s.dashboard_id
        WHERE s.dashboard_id = :dashboard_id
          AND d.owner_email  = :owner_email
          AND d.is_deleted   = false
        ORDER BY s.shared_at ASC
        """,
        [sql_param("dashboard_id", dashboard_id), sql_param("owner_email", owner_email)],
        endpoint_hint="platform.dashboards.list_shares",
    )


def share_dashboard(
    token: str,
    dashboard_id: str,
    owner_email: str,
    shared_with_email: str,
) -> Optional[dict]:
    """Grant an explicit share to another user.

    Verifies that the dashboard exists, is not deleted, and that ``owner_email``
    is the owner before inserting the share row. Uses INSERT OR IGNORE semantics
    via a SELECT-then-conditional-INSERT pattern to be idempotent.

    Args:
        token: Databricks access token.
        dashboard_id: UUID of the dashboard to share.
        owner_email: Email of the requesting user; must be the dashboard owner.
        shared_with_email: Email of the user to share with.

    Returns:
        Row dict with share details on success, or ``None`` when the dashboard
        does not exist, is deleted, or the caller is not the owner.
    """
    definitions = _dtbl("dashboard_definitions")
    shares = _dtbl("dashboard_shares")

    rows = run_sql(
        token,
        f"""
        SELECT id FROM {definitions}
        WHERE id          = :dashboard_id
          AND owner_email = :owner_email
          AND is_deleted  = false
        """,
        [sql_param("dashboard_id", dashboard_id), sql_param("owner_email", owner_email)],
        endpoint_hint="platform.dashboards.share_check",
    )
    if not rows:
        return None

    now = datetime.now(timezone.utc).isoformat()

    # Upsert: only insert when no existing row matches the composite key.
    existing = run_sql(
        token,
        f"""
        SELECT dashboard_id FROM {shares}
        WHERE dashboard_id      = :dashboard_id
          AND shared_with_email = :shared_with_email
        """,
        [sql_param("dashboard_id", dashboard_id), sql_param("shared_with_email", shared_with_email)],
        endpoint_hint="platform.dashboards.share_exists",
    )
    if not existing:
        run_sql(
            token,
            f"""
            INSERT INTO {shares}
                (dashboard_id, shared_with_email, shared_by_email, shared_at)
            VALUES
                (:dashboard_id, :shared_with_email, :shared_by_email, :now)
            """,
            [
                sql_param("dashboard_id", dashboard_id),
                sql_param("shared_with_email", shared_with_email),
                sql_param("shared_by_email", owner_email),
                sql_param("now", now),
            ],
            endpoint_hint="platform.dashboards.share_insert",
        )

    return {
        "dashboard_id": dashboard_id,
        "shared_with_email": shared_with_email,
        "shared_by_email": owner_email,
        "shared_at": now,
    }


def unshare_dashboard(
    token: str,
    dashboard_id: str,
    owner_email: str,
    shared_with_email: str,
) -> bool:
    """Remove an explicit share row.

    Verifies ownership before deleting. Returns ``False`` when the dashboard
    does not exist, is deleted, or the caller is not the owner.

    Args:
        token: Databricks access token.
        dashboard_id: UUID of the dashboard to modify.
        owner_email: Email of the requesting user; must be the dashboard owner.
        shared_with_email: Email of the user whose share access to revoke.

    Returns:
        ``True`` when the share was removed (or did not exist), ``False`` on
        ownership / existence failure.
    """
    definitions = _dtbl("dashboard_definitions")
    shares = _dtbl("dashboard_shares")

    rows = run_sql(
        token,
        f"""
        SELECT id FROM {definitions}
        WHERE id          = :dashboard_id
          AND owner_email = :owner_email
          AND is_deleted  = false
        """,
        [sql_param("dashboard_id", dashboard_id), sql_param("owner_email", owner_email)],
        endpoint_hint="platform.dashboards.unshare_check",
    )
    if not rows:
        return False

    run_sql(
        token,
        f"""
        DELETE FROM {shares}
        WHERE dashboard_id      = :dashboard_id
          AND shared_with_email = :shared_with_email
        """,
        [sql_param("dashboard_id", dashboard_id), sql_param("shared_with_email", shared_with_email)],
        endpoint_hint="platform.dashboards.unshare_delete",
    )
    return True


def delete_dashboard(token: str, dashboard_id: str, email: str) -> bool:
    """Soft-delete a dashboard by setting ``is_deleted = true``.

    Only the dashboard owner can delete their own dashboard. Two sequential
    ``run_sql`` calls: the first verifies existence and ownership; the second
    performs the soft-delete UPDATE.

    Args:
        token: Databricks access token.
        dashboard_id: UUID of the dashboard to delete.
        email: Email of the requesting user; must match ``owner_email``.

    Returns:
        ``True`` when the dashboard was found, owned by ``email``, and
        successfully soft-deleted. ``False`` when the dashboard does not exist,
        is already deleted, or the caller is not the owner.
    """
    definitions = _dtbl("dashboard_definitions")

    # Non-atomic: concurrent deletes can both pass the SELECT. Acceptable for MVP.
    rows = run_sql(
        token,
        f"""
        SELECT id FROM {definitions}
        WHERE id = :dashboard_id
          AND owner_email = :email
          AND is_deleted = false
        """,
        [
            sql_param("dashboard_id", dashboard_id),
            sql_param("email", email),
        ],
        endpoint_hint="platform.dashboards.delete_check",
    )
    if not rows:
        return False

    run_sql(
        token,
        f"UPDATE {definitions} SET is_deleted = true WHERE id = :dashboard_id",
        [sql_param("dashboard_id", dashboard_id)],
        endpoint_hint="platform.dashboards.delete_execute",
    )
    return True
