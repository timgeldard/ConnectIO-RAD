"""Tests for layout_validation — pure-Python mocks, no Databricks dependency."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch

import pytest

from envmon_backend.spatial_config.application.layout_validation import (
    ValidationResult,
    validate_draft_layout,
)


# ---------------------------------------------------------------------------
# Helpers / fixtures
# ---------------------------------------------------------------------------

_RECT_GEO = json.dumps({
    "type": "rectangle",
    "x_pct": 10.0,
    "y_pct": 10.0,
    "width_pct": 40.0,
    "height_pct": 30.0,
})

_SMALL_ZONE_GEO = json.dumps({
    "type": "rectangle",
    "x_pct": 60.0,
    "y_pct": 60.0,
    "width_pct": 20.0,
    "height_pct": 20.0,
})


def _zone(zone_id: str = "zone-1", geo: str = _RECT_GEO, name: str = "Packing Hall") -> dict:
    return {
        "zone_id": zone_id,
        "plant_id": "P225",
        "floor_id": "F1",
        "zone_name": name,
        "geometry_type": "rectangle",
        "geometry_json": geo,
        "revision_id": "rev-001",
        "status": "draft",
    }


def _coord(
    func_loc_id: str = "LOC-001",
    x: float = 30.0,
    y: float = 25.0,
    parent_zone_id: str | None = "zone-1",
    floor_id: str = "F1",
) -> dict:
    return {
        "func_loc_id": func_loc_id,
        "floor_id": floor_id,
        "x_pos": x,
        "y_pos": y,
        "parent_zone_id": parent_zone_id,
        "placement_source": "manual",
        "revision_id": "rev-001",
        "validation_status": None,
        "validation_messages_json": None,
    }


async def _run_validation(zones: list, coords: list) -> ValidationResult:
    """Run validate_draft_layout with DAL layers mocked."""
    with patch(
        "envmon_backend.spatial_config.application.layout_validation.zones_dal.fetch_zones",
        new=AsyncMock(return_value=zones),
    ), patch(
        "envmon_backend.spatial_config.application.layout_validation.coordinates_dal.fetch_studio_coordinates",
        new=AsyncMock(return_value=coords),
    ):
        return await validate_draft_layout("token", "P225", "F1", "rev-001")


# ---------------------------------------------------------------------------
# Blocking error: L5 outside parent zone
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_validate_l5_inside_zone_is_ok():
    zones = [_zone()]
    coords = [_coord(x=30.0, y=25.0)]  # inside the 10-50 x 10-40 rectangle
    result = await _run_validation(zones, coords)
    assert result.is_publishable
    assert not any(i.code == "L5_OUTSIDE_PARENT_ZONE" for i in result.issues)


@pytest.mark.anyio
async def test_validate_l5_outside_zone_is_blocking_error():
    zones = [_zone()]
    coords = [_coord(x=80.0, y=80.0)]  # outside the zone
    result = await _run_validation(zones, coords)
    blocking = [i for i in result.blocking_errors if i.code == "L5_OUTSIDE_PARENT_ZONE"]
    assert len(blocking) == 1
    assert blocking[0].subject_id == "LOC-001"
    assert not result.is_publishable


# ---------------------------------------------------------------------------
# Blocking error: L5 no parent zone
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_validate_l5_no_parent_zone_is_blocking_error():
    zones = [_zone()]
    coords = [_coord(parent_zone_id=None)]
    result = await _run_validation(zones, coords)
    blocking = [i for i in result.blocking_errors if i.code == "L5_NO_PARENT_ZONE"]
    assert len(blocking) == 1
    assert not result.is_publishable


# ---------------------------------------------------------------------------
# Blocking error: L4 geometry checks
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_validate_l4_outside_canvas_is_blocking_error():
    bad_geo = json.dumps({
        "type": "rectangle",
        "x_pct": 80.0,
        "y_pct": 80.0,
        "width_pct": 30.0,   # extends to 110 — out of bounds
        "height_pct": 30.0,
    })
    zones = [_zone(geo=bad_geo)]
    result = await _run_validation(zones, [])
    blocking = [i for i in result.blocking_errors if i.code == "L4_OUTSIDE_CANVAS"]
    assert len(blocking) == 1
    assert not result.is_publishable


@pytest.mark.anyio
async def test_validate_l4_self_intersecting_is_blocking_error():
    # Bowtie polygon
    bowtie_geo = json.dumps({
        "type": "polygon",
        "points": [
            {"x_pct": 0.0, "y_pct": 0.0},
            {"x_pct": 50.0, "y_pct": 50.0},
            {"x_pct": 50.0, "y_pct": 0.0},
            {"x_pct": 0.0, "y_pct": 50.0},
        ],
    })
    zones = [_zone(geo=bowtie_geo)]
    result = await _run_validation(zones, [])
    blocking = [i for i in result.blocking_errors if i.code == "L4_SELF_INTERSECTING"]
    assert len(blocking) == 1


# ---------------------------------------------------------------------------
# Warning: overlapping zones
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_overlapping_zones_is_warning_not_blocking():
    # Two zones that overlap (RECT_GEO spans 10-50 × 10-40; SMALL_ZONE_GEO spans 60-80 × 60-80 — no overlap)
    # Use a zone that actually overlaps with zone-1
    overlap_geo = json.dumps({
        "type": "rectangle",
        "x_pct": 40.0,
        "y_pct": 30.0,
        "width_pct": 30.0,
        "height_pct": 30.0,
    })
    zones = [
        _zone(zone_id="zone-1", geo=_RECT_GEO, name="Zone A"),
        _zone(zone_id="zone-2", geo=overlap_geo, name="Zone B"),
    ]
    result = await _run_validation(zones, [])
    warnings = [i for i in result.warnings if i.code == "L4_ZONES_OVERLAP"]
    assert len(warnings) >= 1
    # Overlapping zones do NOT block publish
    assert result.is_publishable


# ---------------------------------------------------------------------------
# Warning: zone no children
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_zone_with_no_children_is_warning():
    zones = [_zone()]
    result = await _run_validation(zones, [])   # no coords at all
    warnings = [i for i in result.warnings if i.code == "L4_ZONE_NO_CHILDREN"]
    assert len(warnings) == 1


# ---------------------------------------------------------------------------
# Warning: L5 near boundary
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_l5_near_boundary_is_warning():
    # Zone: 10-50 x 10-40. A point at (10.5, 25) is 0.5% from left boundary.
    zones = [_zone()]
    coords = [_coord(x=10.5, y=25.0)]  # very close to left edge
    result = await _run_validation(zones, coords)
    warnings = [i for i in result.warnings if i.code == "L5_NEAR_BOUNDARY"]
    assert len(warnings) == 1
    assert warnings[0].subject_id == "LOC-001"


# ---------------------------------------------------------------------------
# Clean layout passes
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_validate_passes_with_only_warnings():
    # Two zones that overlap (warning only) but no blocking errors
    overlap_geo = json.dumps({
        "type": "rectangle",
        "x_pct": 40.0, "y_pct": 30.0,
        "width_pct": 30.0, "height_pct": 30.0,
    })
    zones = [
        _zone(zone_id="zone-1", geo=_RECT_GEO, name="Zone A"),
        _zone(zone_id="zone-2", geo=overlap_geo, name="Zone B"),
    ]
    # L5 in zone-1, well within bounds
    coords = [_coord(x=30.0, y=25.0, parent_zone_id="zone-1")]
    result = await _run_validation(zones, coords)
    assert result.is_publishable
    assert len(result.blocking_errors) == 0


# ---------------------------------------------------------------------------
# Empty layout (no zones, no coords)
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_empty_layout_is_publishable():
    result = await _run_validation([], [])
    assert result.is_publishable
    assert result.issues == []
