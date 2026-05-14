"""Tests for spatial_config.domain.zone and spatial_config.domain.revision.

These tests import only stdlib and domain modules, so they run without any
Databricks or shared-library dependencies.
"""

import json
import math
from datetime import datetime, timezone

import pytest

from envmon_backend.spatial_config.domain.revision import LayoutRevision
from envmon_backend.spatial_config.domain.zone import LayoutZone


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_RECT_GEO = json.dumps({
    "type": "rectangle",
    "x_pct": 10.0,
    "y_pct": 10.0,
    "width_pct": 40.0,
    "height_pct": 30.0,
})

_POLY_GEO = json.dumps({
    "type": "polygon",
    "points": [
        {"x_pct": 20.0, "y_pct": 20.0},
        {"x_pct": 60.0, "y_pct": 20.0},
        {"x_pct": 60.0, "y_pct": 50.0},
        {"x_pct": 20.0, "y_pct": 50.0},
    ],
})

def _make_zone(**overrides) -> LayoutZone:
    defaults = dict(
        zone_id="zone-abc",
        plant_id="P225",
        floor_id="F1",
        zone_name="Packing Hall",
        geometry_type="rectangle",
        geometry_json=_RECT_GEO,
        revision_id="rev-001",
    )
    defaults.update(overrides)
    return LayoutZone(**defaults)


def _make_revision(**overrides) -> LayoutRevision:
    defaults = dict(
        revision_id="rev-001",
        plant_id="P225",
        floor_id="F1",
        revision_number=1,
        state="draft",
        base_revision_id=None,
        change_reason=None,
        created_by="tim@example.com",
        created_at=datetime(2026, 5, 13, 10, 0, 0, tzinfo=timezone.utc),
    )
    defaults.update(overrides)
    return LayoutRevision(**defaults)


# ---------------------------------------------------------------------------
# LayoutZone — construction
# ---------------------------------------------------------------------------

class TestLayoutZoneConstruction:
    def test_valid_rectangle_zone_constructs(self):
        zone = _make_zone()
        assert zone.zone_id == "zone-abc"
        assert zone.plant_id == "P225"

    def test_valid_polygon_zone_constructs(self):
        zone = _make_zone(geometry_type="polygon", geometry_json=_POLY_GEO)
        assert zone.geometry_type == "polygon"

    def test_empty_required_fields_raise(self):
        for field in ("zone_id", "plant_id", "floor_id", "zone_name", "revision_id"):
            with pytest.raises(ValueError, match=field):
                _make_zone(**{field: ""})

    def test_invalid_geometry_type_raises(self):
        with pytest.raises(ValueError, match="geometry_type"):
            _make_zone(geometry_type="circle")

    def test_invalid_json_raises(self):
        with pytest.raises(ValueError, match="not valid JSON"):
            _make_zone(geometry_json="not-json")

    def test_json_array_raises(self):
        with pytest.raises(ValueError, match="JSON object"):
            _make_zone(geometry_json="[1, 2, 3]")


# ---------------------------------------------------------------------------
# LayoutZone — geometry helpers
# ---------------------------------------------------------------------------

class TestLayoutZoneGeometry:
    def test_rectangle_to_points_produces_four_points(self):
        zone = _make_zone()
        pts = zone.to_points()
        assert len(pts) == 4

    def test_polygon_to_points_preserves_vertices(self):
        zone = _make_zone(geometry_type="polygon", geometry_json=_POLY_GEO)
        pts = zone.to_points()
        assert len(pts) == 4
        assert pts[0] == {"x_pct": 20.0, "y_pct": 20.0}

    def test_rectangle_bbox(self):
        zone = _make_zone()
        bbox = zone.bbox()
        assert bbox["x_min_pct"] == 10.0
        assert bbox["y_min_pct"] == 10.0
        assert bbox["x_max_pct"] == 50.0   # 10 + 40
        assert bbox["y_max_pct"] == 40.0   # 10 + 30

    def test_rectangle_centroid(self):
        zone = _make_zone()
        cx, cy = zone.centroid()
        assert math.isclose(cx, 30.0, abs_tol=1e-9)
        assert math.isclose(cy, 25.0, abs_tol=1e-9)

    def test_contains_point_inside_returns_true(self):
        zone = _make_zone()
        assert zone.contains_point(30.0, 25.0) is True

    def test_contains_point_outside_returns_false(self):
        zone = _make_zone()
        assert zone.contains_point(5.0, 5.0) is False


# ---------------------------------------------------------------------------
# LayoutRevision — construction
# ---------------------------------------------------------------------------

class TestLayoutRevisionConstruction:
    def test_valid_draft_revision_constructs(self):
        rev = _make_revision()
        assert rev.revision_id == "rev-001"
        assert rev.state == "draft"

    def test_all_valid_states_construct(self):
        for state in ("draft", "published", "superseded", "rolled_back"):
            rev = _make_revision(state=state)
            assert rev.state == state

    def test_empty_required_fields_raise(self):
        for field in ("revision_id", "plant_id", "floor_id", "created_by"):
            with pytest.raises(ValueError, match=field):
                _make_revision(**{field: ""})

    def test_revision_number_zero_raises(self):
        with pytest.raises(ValueError, match="revision_number"):
            _make_revision(revision_number=0)

    def test_negative_revision_number_raises(self):
        with pytest.raises(ValueError, match="revision_number"):
            _make_revision(revision_number=-1)

    def test_invalid_state_raises(self):
        with pytest.raises(ValueError, match="state"):
            _make_revision(state="pending")


# ---------------------------------------------------------------------------
# LayoutRevision — state queries
# ---------------------------------------------------------------------------

class TestLayoutRevisionStateQueries:
    def test_draft_is_publishable(self):
        rev = _make_revision(state="draft")
        assert rev.is_publishable() is True
        assert rev.is_active() is False

    def test_published_is_active_not_publishable(self):
        rev = _make_revision(state="published")
        assert rev.is_active() is True
        assert rev.is_publishable() is False

    def test_superseded_is_neither(self):
        rev = _make_revision(state="superseded")
        assert rev.is_publishable() is False
        assert rev.is_active() is False

    def test_rolled_back_is_neither(self):
        rev = _make_revision(state="rolled_back")
        assert rev.is_publishable() is False
        assert rev.is_active() is False
