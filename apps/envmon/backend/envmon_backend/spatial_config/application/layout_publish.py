"""Application service for draft creation, publishing, and layout retrieval.

Orchestrates the full layout lifecycle: draft creation, publishing
(validate → supersede previous → publish → copy coordinates), and
read-only layout queries for both draft and published states.

Must not import ``fastapi`` (application-layer isolation enforced by
test_architecture_boundaries).
"""

from __future__ import annotations

import asyncio
import json
import uuid
from datetime import datetime, timezone

from envmon_backend.spatial_config.application.layout_validation import (
    ValidationResult,
    validate_draft_layout,
)
from envmon_backend.spatial_config.dal import coordinates as coordinates_dal
from envmon_backend.spatial_config.dal import floors as floors_dal
from envmon_backend.spatial_config.dal import zones as zones_dal
from envmon_backend.spatial_config.dal.revisions import (
    create_revision,
    fetch_active_revision,
    fetch_draft_revision,
    fetch_revision,
    fetch_revisions,
    set_active_revision,
    supersede_active_revision,
    update_revision_state,
)
from envmon_backend.spatial_config.domain.revision import LayoutRevision


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _revision_from_row(row: dict) -> LayoutRevision:
    """Construct a :class:`LayoutRevision` from a DAL result row.

    Args:
        row: Dict returned by any revision DAL fetch function.

    Returns:
        Populated :class:`LayoutRevision` domain entity.
    """
    created_at = row["created_at"]
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at)

    return LayoutRevision(
        revision_id=row["revision_id"],
        plant_id=row["plant_id"],
        floor_id=row["floor_id"],
        revision_number=int(row["revision_number"]),
        state=row["state"],
        base_revision_id=row.get("base_revision_id"),
        change_reason=row.get("change_reason"),
        created_by=row["created_by"],
        created_at=created_at,
    )


async def _next_revision_number(token: str, plant_id: str, floor_id: str) -> int:
    """Return the next revision_number for a floor (max existing + 1, or 1 for new floors).

    Args:
        token: Databricks access token.
        plant_id: SAP plant code.
        floor_id: Floor identifier.

    Returns:
        Next integer revision number.
    """
    rows = await fetch_revisions(token, plant_id, floor_id, limit=1)
    if not rows:
        return 1
    return int(rows[0]["revision_number"]) + 1


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def get_or_create_draft(
    token: str,
    plant_id: str,
    floor_id: str,
    user_identity: str,
) -> LayoutRevision:
    """Return the open draft for a floor, or create a new one if none exists.

    If a draft already exists it is returned unchanged. If not, a new draft is
    inserted with revision_number = (max existing + 1) and base_revision_id
    pointing to the current published revision (if any).

    Args:
        token: Databricks access token.
        plant_id: SAP plant code.
        floor_id: Floor identifier.
        user_identity: Email or service principal creating the draft.

    Returns:
        The existing or newly created draft :class:`LayoutRevision`.
    """
    existing = await fetch_draft_revision(token, plant_id, floor_id)
    if existing:
        return _revision_from_row(existing[0])

    revision_id = str(uuid.uuid4())
    revision_number = await _next_revision_number(token, plant_id, floor_id)

    active_rows = await fetch_active_revision(token, plant_id, floor_id)
    base_revision_id = active_rows[0]["revision_id"] if active_rows else None

    await create_revision(
        token,
        revision_id=revision_id,
        plant_id=plant_id,
        floor_id=floor_id,
        revision_number=revision_number,
        created_by=user_identity,
        base_revision_id=base_revision_id,
    )

    rows = await fetch_draft_revision(token, plant_id, floor_id)
    return _revision_from_row(rows[0])


async def publish_layout(
    token: str,
    plant_id: str,
    floor_id: str,
    revision_id: str,
    change_reason: str,
    user_identity: str,
) -> LayoutRevision:
    """Publish a draft layout after validation.

    Steps:
    1. Load the draft revision — raise ``ValueError`` if missing or not in 'draft' state.
    2. Run validation — raise ``ValueError`` with blocking error summary if unpublishable.
    3. Supersede the previously published revision (if any).
    4. Mark this revision as 'published' with metadata.
    5. Update ``em_plant_floor.active_revision_id``.
    6. Stamp each coordinate with its zone assignment and validation outcome.

    Args:
        token: Databricks access token.
        plant_id: SAP plant code.
        floor_id: Floor identifier.
        revision_id: UUID of the draft revision to publish.
        change_reason: Non-empty reason for this layout change (required).
        user_identity: Identity of the user initiating the publish.

    Returns:
        The newly published :class:`LayoutRevision`.

    Raises:
        ValueError: If the change_reason is empty, the revision is not found,
            is not a draft, or the draft has blocking validation errors.
    """
    if not change_reason or not change_reason.strip():
        raise ValueError("PUBLISH_NO_REASON: change_reason is required when publishing a layout.")

    draft_rows = await fetch_draft_revision(token, plant_id, floor_id)
    if not draft_rows:
        raise ValueError("PUBLISH_NO_DRAFT: no draft revision found for this floor.")

    draft_row = draft_rows[0]
    if draft_row["revision_id"] != revision_id:
        raise ValueError(
            f"Revision '{revision_id}' is not the active draft for {plant_id}/{floor_id}."
        )
    if draft_row["state"] != "draft":
        raise ValueError(
            f"Revision '{revision_id}' is in state '{draft_row['state']}'; only drafts can be published."
        )

    # Run validation — fail-fast if blocking errors exist
    validation: ValidationResult = await validate_draft_layout(token, plant_id, floor_id, revision_id)
    if not validation.is_publishable:
        codes = [e.code for e in validation.blocking_errors]
        raise ValueError(
            f"Layout has {len(validation.blocking_errors)} blocking error(s): {codes}. "
            "Fix all blocking errors before publishing."
        )

    published_at = datetime.now(tz=timezone.utc).isoformat()
    publish_summary = json.dumps({
        "zone_count": len(await zones_dal.fetch_zones(token, plant_id, floor_id, revision_id)),
        "blocking_error_count": len(validation.blocking_errors),
        "warning_count": len(validation.warnings),
    })
    validation_summary = json.dumps({
        "issues": [
            {"severity": i.severity, "code": i.code, "subject_id": i.subject_id}
            for i in validation.issues
        ]
    })

    # Supersede the current published revision (if any) and clear active_revision_id
    await supersede_active_revision(token, plant_id, floor_id)

    # Mark this revision as published
    await update_revision_state(
        token,
        revision_id=revision_id,
        state="published",
        published_by=user_identity,
        published_at=published_at,
        change_reason=change_reason.strip(),
        publish_summary_json=publish_summary,
        validation_summary_json=validation_summary,
    )

    # Set active_revision_id on the floor row
    await set_active_revision(token, plant_id, floor_id, revision_id)

    # Stamp all coordinate rows with zone assignment in a single bulk MERGE
    coord_rows = await coordinates_dal.fetch_studio_coordinates(token, plant_id, floor_id)
    issues_by_subject = {}
    for issue in validation.issues:
        if issue.subject_id:
            issues_by_subject.setdefault(issue.subject_id, []).append(issue)

    coord_updates = []
    for coord in coord_rows:
        func_loc_id = coord["func_loc_id"]
        coord_issues = issues_by_subject.get(func_loc_id, [])
        has_error = any(i.severity == "blocking_error" for i in coord_issues)
        has_warning = any(i.severity == "warning" for i in coord_issues)
        coord_updates.append({
            "func_loc_id": func_loc_id,
            "parent_zone_id": coord.get("parent_zone_id"),
            "revision_id": revision_id,
            "placement_source": coord.get("placement_source") or "manual",
            "validation_status": "error" if has_error else ("warning" if has_warning else "ok"),
            "validation_messages_json": json.dumps([i.message for i in coord_issues]) if coord_issues else None,
        })

    await coordinates_dal.bulk_update_coordinate_zone_assignments(token, plant_id, updates=coord_updates)

    # Return the now-published revision
    rows = await fetch_revision(token, revision_id)
    return _revision_from_row(rows[0])


async def rollback_layout(
    token: str,
    plant_id: str,
    floor_id: str,
    target_revision_id: str,
    change_reason: str,
    user_identity: str,
) -> LayoutRevision:
    """Rollback to a previous published revision.

    .. note::
        Rollback is not yet implemented. This stub is provided so the router
        can expose the endpoint and return a clear error message. Full
        implementation is planned for Slice 12.

    Raises:
        NotImplementedError: Always.
    """
    raise NotImplementedError(
        "Rollback is deferred to Slice 12. The data model supports it via "
        "rolled_back_from_revision_id, but the coordinate revert logic is not yet implemented."
    )


async def get_published_layout(token: str, plant_id: str, floor_id: str) -> dict:
    """Return the current published layout for operational/analytics use.

    **Resolution rule:** Always returns the currently published revision.
    Historical inspection results are always displayed against the current
    published layout — no time-valid revision lookup.

    If no published revision exists (floor has not gone through Studio yet),
    returns ``revision: null`` with zones from the raw coordinate table for
    backward compatibility with pre-Studio deployments.

    Args:
        token: Databricks access token.
        plant_id: SAP plant code.
        floor_id: Floor identifier.

    Returns:
        Dict with ``revision`` (or ``None``), ``zones``, and ``coordinates``.
    """
    active_rows = await fetch_active_revision(token, plant_id, floor_id)
    if not active_rows:
        coord_rows = await coordinates_dal.fetch_mapped_locations(token, plant_id)
        floor_coords = [r for r in coord_rows if r.get("floor_id") == floor_id]
        return {
            "revision": None,
            "zones": [],
            "coordinates": floor_coords,
        }

    revision_row = active_rows[0]
    revision_id = revision_row["revision_id"]
    zone_rows, coord_rows = await _load_layout_data(token, plant_id, floor_id, revision_id)
    return {
        "revision": revision_row,
        "zones": zone_rows,
        "coordinates": coord_rows,
    }


async def get_draft_layout(token: str, plant_id: str, floor_id: str) -> dict | None:
    """Return the current draft layout for the authoring UI.

    Args:
        token: Databricks access token.
        plant_id: SAP plant code.
        floor_id: Floor identifier.

    Returns:
        Dict with ``revision``, ``zones``, and ``coordinates`` if a draft exists;
        ``None`` if no open draft is found.
    """
    draft_rows = await fetch_draft_revision(token, plant_id, floor_id)
    if not draft_rows:
        return None

    revision_row = draft_rows[0]
    revision_id = revision_row["revision_id"]
    zone_rows, coord_rows = await _load_layout_data(token, plant_id, floor_id, revision_id)
    return {
        "revision": revision_row,
        "zones": zone_rows,
        "coordinates": coord_rows,
    }


async def list_revisions(token: str, plant_id: str, floor_id: str) -> list[dict]:
    """Return recent revision history for a floor.

    Args:
        token: Databricks access token.
        plant_id: SAP plant code.
        floor_id: Floor identifier.

    Returns:
        List of revision row dicts, newest first (up to 20).
    """
    return await fetch_revisions(token, plant_id, floor_id, limit=20)


async def _load_layout_data(
    token: str,
    plant_id: str,
    floor_id: str,
    revision_id: str,
) -> tuple[list[dict], list[dict]]:
    """Load zones and coordinates for a given revision concurrently.

    Args:
        token: Databricks access token.
        plant_id: SAP plant code.
        floor_id: Floor identifier.
        revision_id: Revision UUID to scope zone loading.

    Returns:
        ``(zone_rows, coord_rows)`` tuple.
    """
    zone_rows, coord_rows = await asyncio.gather(
        zones_dal.fetch_zones(token, plant_id, floor_id, revision_id),
        coordinates_dal.fetch_studio_coordinates(token, plant_id, floor_id),
    )
    return zone_rows, coord_rows
