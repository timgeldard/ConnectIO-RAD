"""
Spatial Studio bounded context — authoring endpoints for the layout lifecycle.

Endpoints (all mounted under /api/em/spatial):

    GET    /floors/{floor_id}/layout          — Published layout for analytics
    GET    /floors/{floor_id}/draft           — Current draft layout for authoring UI
    POST   /floors/{floor_id}/draft           — Create or re-open a draft (idempotent)
    POST   /floors/{floor_id}/zones           — Upsert an L4 zone in the open draft
    DELETE /floors/{floor_id}/zones/{zone_id} — Delete a draft zone
    POST   /floors/{floor_id}/validate        — Validate draft, return ValidationResult
    POST   /floors/{floor_id}/publish         — Publish draft with change_reason
    GET    /floors/{floor_id}/revisions       — List revision history (last 20)
    POST   /floors/{floor_id}/rollback        — Rollback stub (Slice 12)
"""

import json as _json
import uuid as _uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from envmon_backend.spatial_config.application import layout_publish as pub
from envmon_backend.spatial_config.application.layout_validation import (
    ValidationIssue,
    ValidationResult,
    validate_draft_layout,
)
from envmon_backend.spatial_config.dal import zones as zones_dal
from envmon_backend.spatial_config.domain.geometry import (
    normalise_geometry,
    polygon_bbox,
    polygon_centroid,
)
from shared_auth import UserIdentity, require_proxy_user

router = APIRouter()


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class ZoneUpsertRequest(BaseModel):
    """Body for creating or updating an L4 zone in a draft revision.

    Args:
        plant_id: SAP plant code.
        revision_id: UUID of the draft revision this zone belongs to.
        zone_name: Human-readable zone label.
        geometry_type: ``'polygon'`` or ``'rectangle'``.
        geometry_json: Canonical geometry as a JSON-serialisable dict.
        functional_location_id: Optional SAP L4 functional location code.
        zone_id: Optional existing zone UUID. When supplied the existing zone is
            updated in-place; when omitted a fresh UUID is generated (create path).
    """

    plant_id: str
    revision_id: str
    zone_name: str
    geometry_type: str
    geometry_json: dict
    functional_location_id: Optional[str] = None
    zone_id: Optional[str] = None


class PublishRequest(BaseModel):
    """Body for publishing a draft layout.

    Args:
        plant_id: SAP plant code.
        revision_id: UUID of the draft revision to publish.
        change_reason: Non-empty reason for this layout change. Required.
    """

    plant_id: str
    revision_id: str
    change_reason: str


class RollbackRequest(BaseModel):
    """Body for rolling back to a previous revision.

    Args:
        plant_id: SAP plant code.
        target_revision_id: UUID of the published revision to restore.
        change_reason: Non-empty reason for the rollback.
    """

    plant_id: str
    target_revision_id: str
    change_reason: str


class ValidationIssueOut(BaseModel):
    """API representation of a single validation issue."""

    severity: str
    code: str
    message: str
    subject_id: Optional[str] = None


class ValidationResultOut(BaseModel):
    """API representation of the full validation result."""

    issues: list[ValidationIssueOut]
    is_publishable: bool


def _issue_out(issue: ValidationIssue) -> ValidationIssueOut:
    """Convert a domain :class:`ValidationIssue` to the API response model."""
    return ValidationIssueOut(
        severity=issue.severity,
        code=issue.code,
        message=issue.message,
        subject_id=issue.subject_id,
    )


# ---------------------------------------------------------------------------
# Published layout — operational / analytics read
# ---------------------------------------------------------------------------

@router.get("/floors/{floor_id}/layout")
async def get_published_layout(
    floor_id: str,
    plant_id: str = Query(..., description="SAP 4-character plant code"),
    user: UserIdentity = Depends(require_proxy_user),
):
    """Return the currently published spatial layout for a floor.

    **Resolution rule:** Always returns the currently published revision.
    If no revision has been published through Studio, returns ``zones=[]``
    and raw coordinates from ``em_location_coordinates`` for backward
    compatibility with pre-Studio deployments.
    """
    token = user.raw_token
    return await pub.get_published_layout(token, plant_id, floor_id)


# ---------------------------------------------------------------------------
# Draft layout — authoring read
# ---------------------------------------------------------------------------

@router.get("/floors/{floor_id}/draft")
async def get_draft_layout(
    floor_id: str,
    plant_id: str = Query(..., description="SAP 4-character plant code"),
    user: UserIdentity = Depends(require_proxy_user),
):
    """Return the current draft layout for the Spatial Studio authoring UI.

    Returns an empty payload when no draft exists (``revision: null``).
    """
    token = user.raw_token
    layout = await pub.get_draft_layout(token, plant_id, floor_id)
    if layout is None:
        return {"revision": None, "zones": [], "coordinates": []}
    return layout


# ---------------------------------------------------------------------------
# Draft creation
# ---------------------------------------------------------------------------

@router.post("/floors/{floor_id}/draft", status_code=201)
async def create_draft(
    floor_id: str,
    plant_id: str = Query(..., description="SAP 4-character plant code"),
    user: UserIdentity = Depends(require_proxy_user),
):
    """Create or return the open draft revision for a floor.

    Idempotent: if a draft already exists it is returned unchanged rather
    than creating a duplicate.
    """
    token = user.raw_token
    identity = user.email or user.sub
    revision = await pub.get_or_create_draft(token, plant_id, floor_id, identity)
    return {
        "revision_id": revision.revision_id,
        "revision_number": revision.revision_number,
        "state": revision.state,
        "created_by": revision.created_by,
    }


# ---------------------------------------------------------------------------
# Zone authoring
# ---------------------------------------------------------------------------

@router.post("/floors/{floor_id}/zones", status_code=201)
async def upsert_zone(
    floor_id: str,
    body: ZoneUpsertRequest,
    user: UserIdentity = Depends(require_proxy_user),
):
    """Insert or update an L4 zone in the current draft revision.

    Derives and persists the bbox and centroid from the supplied geometry.
    A new UUID is generated for the zone_id on every upsert; use the returned
    ``zone_id`` to reference this zone in subsequent requests.
    """
    token = user.raw_token
    geo_dict = dict(body.geometry_json)
    geo_dict["type"] = body.geometry_type
    geometry_json_str = _json.dumps(geo_dict)

    try:
        pts = normalise_geometry(geo_dict)
        bbox = polygon_bbox(pts)
        cx, cy = polygon_centroid(pts)
        bbox_json_str = _json.dumps(bbox)
    except (KeyError, ValueError) as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid geometry_json for geometry_type '{body.geometry_type}': {exc}",
        ) from exc

    zone_id = body.zone_id or str(_uuid.uuid4())
    await zones_dal.upsert_zone(
        token,
        zone_id=zone_id,
        plant_id=body.plant_id,
        floor_id=floor_id,
        func_loc_id=body.functional_location_id,
        zone_name=body.zone_name,
        geometry_type=body.geometry_type,
        geometry_json=geometry_json_str,
        bbox_json=bbox_json_str,
        centroid_x=cx,
        centroid_y=cy,
        revision_id=body.revision_id,
    )
    return {"zone_id": zone_id, "saved": True}


@router.delete("/floors/{floor_id}/zones/{zone_id}", status_code=204)
async def delete_zone(
    floor_id: str,
    zone_id: str,
    revision_id: str = Query(..., description="Draft revision UUID"),
    user: UserIdentity = Depends(require_proxy_user),
):
    """Delete a draft zone. No-op if the zone is not in draft state."""
    token = user.raw_token
    await zones_dal.delete_draft_zone(token, zone_id, revision_id)


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

@router.post("/floors/{floor_id}/validate", response_model=ValidationResultOut)
async def validate_layout(
    floor_id: str,
    plant_id: str = Query(..., description="SAP 4-character plant code"),
    revision_id: str = Query(..., description="Draft revision UUID"),
    user: UserIdentity = Depends(require_proxy_user),
):
    """Validate the draft layout and return all blocking errors, warnings, and suggestions."""
    token = user.raw_token
    result: ValidationResult = await validate_draft_layout(token, plant_id, floor_id, revision_id)
    return ValidationResultOut(
        issues=[_issue_out(i) for i in result.issues],
        is_publishable=result.is_publishable,
    )


# ---------------------------------------------------------------------------
# Publish
# ---------------------------------------------------------------------------

@router.post("/floors/{floor_id}/publish")
async def publish_layout(
    floor_id: str,
    body: PublishRequest,
    user: UserIdentity = Depends(require_proxy_user),
):
    """Publish the draft layout after passing validation.

    Requires a non-empty ``change_reason``. Returns 422 if blocking validation
    errors exist or the draft cannot be found. Updates ``em_plant_floor.active_revision_id``
    and copies zone coordinates to ``em_location_coordinates``.
    """
    token = user.raw_token
    identity = user.email or user.sub
    try:
        revision = await pub.publish_layout(
            token,
            plant_id=body.plant_id,
            floor_id=floor_id,
            revision_id=body.revision_id,
            change_reason=body.change_reason,
            user_identity=identity,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except NotImplementedError as exc:
        raise HTTPException(status_code=501, detail=str(exc)) from exc

    return {
        "revision_id": revision.revision_id,
        "revision_number": revision.revision_number,
        "state": revision.state,
        "change_reason": revision.change_reason,
    }


# ---------------------------------------------------------------------------
# Revision history
# ---------------------------------------------------------------------------

@router.get("/floors/{floor_id}/revisions")
async def list_revisions(
    floor_id: str,
    plant_id: str = Query(..., description="SAP 4-character plant code"),
    user: UserIdentity = Depends(require_proxy_user),
):
    """Return the last 20 revisions for a plant/floor, newest first."""
    token = user.raw_token
    rows = await pub.list_revisions(token, plant_id, floor_id)
    return {"revisions": rows}


# ---------------------------------------------------------------------------
# Rollback (stub — Slice 12)
# ---------------------------------------------------------------------------

@router.post("/floors/{floor_id}/rollback")
async def rollback_layout(
    floor_id: str,
    body: RollbackRequest,
    user: UserIdentity = Depends(require_proxy_user),
):
    """Roll back to a previous published revision.

    .. note::
        Not yet implemented. Returns 501 until Slice 12.
    """
    token = user.raw_token
    identity = user.email or user.sub
    try:
        await pub.rollback_layout(
            token,
            plant_id=body.plant_id,
            floor_id=floor_id,
            target_revision_id=body.target_revision_id,
            change_reason=body.change_reason,
            user_identity=identity,
        )
    except NotImplementedError as exc:
        raise HTTPException(status_code=501, detail=str(exc)) from exc
