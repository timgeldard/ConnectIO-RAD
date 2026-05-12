"""FastAPI router for the composable dashboard API.

Mounts under ``/api/dashboards`` in ``apps/platform/backend/main.py``.

All endpoints require a valid Databricks Apps proxy session (``require_proxy_user``).
Visibility rules (owned / public / explicitly-shared) are enforced in the DAL.
"""
from __future__ import annotations

import json
from functools import partial
from typing import Optional

import anyio
from fastapi import APIRouter, Depends, HTTPException, Query
from shared_auth.identity import UserIdentity, require_proxy_user

from backend.routes.dashboards import dal
from backend.routes.dashboards.models import (
    ComposableDashboardConfig,
    CreateDashboardRequest,
    DashboardDetail,
    DashboardListResponse,
    DashboardShare,
    DashboardShareListResponse,
    DashboardSummary,
    ShareRequest,
    UpdateDashboardRequest,
)

router = APIRouter()


def _parse_tags(raw: object) -> list[str]:
    """Coerce a tags value from the database to a Python list of strings.

    The database stores tags as a JSON string (e.g. ``'["oee","downtime"]'``).
    Delta may also deserialise it as a Python list when the connector supports
    complex types — both cases are handled.

    Args:
        raw: Raw tags value from a DB row (string, list, or None).

    Returns:
        List of strings; empty list on any parse failure.
    """
    if isinstance(raw, list):
        return [str(t) for t in raw]
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            return [str(t) for t in parsed] if isinstance(parsed, list) else []
        except (ValueError, TypeError):
            return []
    return []


def _row_to_summary(row: dict) -> DashboardSummary:
    """Convert a raw DB row dict to a ``DashboardSummary``.

    Args:
        row: Dict with keys matching the columns selected in ``dal.list_dashboards``.

    Returns:
        Validated ``DashboardSummary`` instance.
    """
    return DashboardSummary(
        id=row["id"],
        title=row["title"],
        description=row.get("description"),
        ownerEmail=row["owner_email"],
        isPublic=bool(row.get("is_public")),
        tags=_parse_tags(row.get("tags")),
        version=int(row.get("version") or 1),
        createdAt=str(row.get("created_at", "")),
        updatedAt=str(row.get("updated_at", "")),
    )


def _row_to_detail(row: dict) -> DashboardDetail:
    """Convert a raw DB row (including ``config_json``) to a ``DashboardDetail``.

    Degrades gracefully to an empty config when ``config_json`` is absent or
    malformed — the dashboard record is still usable, only the widget layout is lost.

    Args:
        row: Dict from ``dal.get_dashboard`` or ``dal.create_dashboard``.

    Returns:
        Validated ``DashboardDetail`` instance.
    """
    summary = _row_to_summary(row)
    config_raw = row.get("config_json") or "{}"
    try:
        config_dict = json.loads(config_raw) if isinstance(config_raw, str) else config_raw
        config = ComposableDashboardConfig(**config_dict)
    except Exception:
        config = ComposableDashboardConfig()
    return DashboardDetail(**summary.model_dump(), config=config)


def _row_to_share(row: dict) -> DashboardShare:
    """Convert a raw share DB row to a ``DashboardShare``.

    Args:
        row: Dict with keys from ``dal.list_shares``.

    Returns:
        Validated ``DashboardShare`` instance.
    """
    return DashboardShare(
        dashboardId=row["dashboard_id"],
        sharedWithEmail=row["shared_with_email"],
        sharedByEmail=row["shared_by_email"],
        sharedAt=str(row.get("shared_at", "")),
    )


@router.get(
    "",
    response_model=DashboardListResponse,
    summary="List dashboards",
    tags=["Dashboards"],
)
async def list_dashboards(
    owned_by_me: bool = Query(default=False, alias="ownedByMe"),
    shared_with_me: bool = Query(default=False, alias="sharedWithMe"),
    search: Optional[str] = Query(default=None, max_length=200),
    user: UserIdentity = Depends(require_proxy_user),
) -> DashboardListResponse:
    """Return all dashboards visible to the authenticated user.

    Visibility includes dashboards the user owns, dashboards explicitly shared
    with them, and dashboards marked ``is_public``.

    Args:
        owned_by_me: When True return only dashboards owned by the caller.
        shared_with_me: When True return only dashboards explicitly shared with the caller.
        search: Optional case-insensitive substring search on title and description.
        user: Authenticated user identity injected by the Databricks Apps proxy.

    Returns:
        ``DashboardListResponse`` with a list of summaries and a total count.
    """
    rows = await dal.list_dashboards(
        user.raw_token,
        email=user.email or "",
        owned_by_me=owned_by_me,
        shared_with_me=shared_with_me,
        search=search,
    )
    summaries = [_row_to_summary(r) for r in rows]
    return DashboardListResponse(dashboards=summaries, total=len(summaries))


@router.get(
    "/{dashboard_id}",
    response_model=DashboardDetail,
    summary="Get dashboard",
    tags=["Dashboards"],
)
async def get_dashboard(
    dashboard_id: str,
    user: UserIdentity = Depends(require_proxy_user),
) -> DashboardDetail:
    """Return the full dashboard definition including the current widget config.

    Args:
        dashboard_id: UUID of the dashboard to retrieve.
        user: Authenticated user identity.

    Returns:
        Full ``DashboardDetail`` including the ``ComposableDashboardConfig``.

    Raises:
        HTTPException: 404 when the dashboard does not exist or is not visible.
    """
    row = await dal.get_dashboard(user.raw_token, dashboard_id, user.email or "")
    if row is None:
        raise HTTPException(status_code=404, detail="Dashboard not found.")
    return _row_to_detail(row)


@router.post(
    "",
    response_model=DashboardDetail,
    status_code=201,
    summary="Create dashboard",
    tags=["Dashboards"],
)
async def create_dashboard(
    body: CreateDashboardRequest,
    user: UserIdentity = Depends(require_proxy_user),
) -> DashboardDetail:
    """Create a new dashboard and return the full record.

    The caller becomes the owner. An initial version (version 1) is created
    atomically with the definition record.

    Args:
        body: Dashboard title, optional description, config, visibility, and tags.
        user: Authenticated user identity (becomes the owner).

    Returns:
        Newly created ``DashboardDetail``.
    """
    config_json = body.config.model_dump_json()
    row = await anyio.to_thread.run_sync(
        partial(
            dal.create_dashboard,
            user.raw_token,
            title=body.title,
            description=body.description,
            config_json=config_json,
            owner_email=user.email or "",
            is_public=body.is_public,
            tags=body.tags,
        )
    )
    return _row_to_detail(row)


@router.put(
    "/{dashboard_id}",
    response_model=DashboardDetail,
    summary="Update dashboard",
    tags=["Dashboards"],
)
async def update_dashboard(
    dashboard_id: str,
    body: UpdateDashboardRequest,
    user: UserIdentity = Depends(require_proxy_user),
) -> DashboardDetail:
    """Save a new config version and patch metadata for an existing dashboard.

    Only the dashboard owner may call this endpoint. The full widget config must
    always be supplied (PUT semantics — no partial config merging). Metadata
    fields (``title``, ``description``, ``isPublic``, ``tags``) are optional;
    omitting them keeps the current values.

    Args:
        dashboard_id: UUID of the dashboard to update.
        body: New config (required) and optional metadata patches.
        user: Authenticated user identity; must be the dashboard owner.

    Returns:
        Updated ``DashboardDetail`` reflecting the new version.

    Raises:
        HTTPException: 404 when the dashboard does not exist or the caller is
            not the owner (ownership is not disclosed to avoid information leakage).
    """
    config_json = body.config.model_dump_json()
    row = await anyio.to_thread.run_sync(
        partial(
            dal.update_dashboard,
            user.raw_token,
            dashboard_id,
            user.email or "",
            title=body.title,
            description=body.description,
            config_json=config_json,
            is_public=body.is_public,
            tags=body.tags,
        )
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Dashboard not found.")
    return _row_to_detail(row)


@router.delete(
    "/{dashboard_id}",
    status_code=204,
    summary="Delete dashboard",
    tags=["Dashboards"],
)
async def delete_dashboard(
    dashboard_id: str,
    user: UserIdentity = Depends(require_proxy_user),
) -> None:
    """Soft-delete a dashboard (sets ``is_deleted = true``).

    Only the dashboard owner may delete their own dashboard. Returns 404 for
    both "not found" and "not owner" to avoid disclosing dashboard existence
    to unauthorised callers.

    Args:
        dashboard_id: UUID of the dashboard to delete.
        user: Authenticated user identity; must be the dashboard owner.

    Raises:
        HTTPException: 404 when the dashboard does not exist or the caller is
            not the owner.
    """
    deleted = await anyio.to_thread.run_sync(
        partial(dal.delete_dashboard, user.raw_token, dashboard_id, user.email or "")
    )
    if not deleted:
        raise HTTPException(status_code=404, detail="Dashboard not found.")


@router.get(
    "/{dashboard_id}/shares",
    response_model=DashboardShareListResponse,
    summary="List dashboard shares",
    tags=["Dashboards"],
)
async def list_dashboard_shares(
    dashboard_id: str,
    user: UserIdentity = Depends(require_proxy_user),
) -> DashboardShareListResponse:
    """Return all users that have been explicitly granted access to a dashboard.

    Only the dashboard owner may call this endpoint. Non-owners receive 404 to
    avoid leaking whether the dashboard exists.

    Args:
        dashboard_id: UUID of the dashboard to inspect.
        user: Authenticated user identity; must be the dashboard owner.

    Returns:
        ``DashboardShareListResponse`` with a list of share records and a total count.

    Raises:
        HTTPException: 404 when the dashboard does not exist or the caller is
            not the owner.
    """
    rows = await anyio.to_thread.run_sync(
        partial(dal.list_shares, user.raw_token, dashboard_id, user.email or "")
    )
    shares = [_row_to_share(r) for r in rows]
    return DashboardShareListResponse(shares=shares, total=len(shares))


@router.post(
    "/{dashboard_id}/shares",
    response_model=DashboardShare,
    status_code=201,
    summary="Share dashboard",
    tags=["Dashboards"],
)
async def share_dashboard(
    dashboard_id: str,
    body: ShareRequest,
    user: UserIdentity = Depends(require_proxy_user),
) -> DashboardShare:
    """Grant explicit view access to another user.

    Idempotent — sharing with an already-shared user returns 201 with the
    existing share record. Only the dashboard owner may share.

    Args:
        dashboard_id: UUID of the dashboard to share.
        body: ``ShareRequest`` containing the recipient email.
        user: Authenticated user identity; must be the dashboard owner.

    Returns:
        The created (or existing) ``DashboardShare`` record.

    Raises:
        HTTPException: 404 when the dashboard does not exist or the caller is
            not the owner.
    """
    row = await anyio.to_thread.run_sync(
        partial(dal.share_dashboard, user.raw_token, dashboard_id, user.email or "", body.email)
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Dashboard not found.")
    return _row_to_share(row)


@router.delete(
    "/{dashboard_id}/shares/{shared_with_email}",
    status_code=204,
    summary="Unshare dashboard",
    tags=["Dashboards"],
)
async def unshare_dashboard(
    dashboard_id: str,
    shared_with_email: str,
    user: UserIdentity = Depends(require_proxy_user),
) -> None:
    """Revoke explicit view access from a user.

    Returns 204 whether or not the share row existed, provided the caller is
    the owner. Returns 404 when the dashboard does not exist or the caller is
    not the owner.

    Args:
        dashboard_id: UUID of the dashboard to modify.
        shared_with_email: Email of the user whose access to revoke.
        user: Authenticated user identity; must be the dashboard owner.

    Raises:
        HTTPException: 404 when the dashboard does not exist or the caller is
            not the owner.
    """
    ok = await anyio.to_thread.run_sync(
        partial(dal.unshare_dashboard, user.raw_token, dashboard_id, user.email or "", shared_with_email)
    )
    if not ok:
        raise HTTPException(status_code=404, detail="Dashboard not found.")
