"""Tests for spatial_config.domain.geometry — pure geometry functions.

These tests import only stdlib and the geometry module itself, so they run
without any Databricks or shared-library dependencies.
"""

import math
import pytest

from envmon_backend.spatial_config.domain.geometry import (
    canvas_bounds_check,
    is_self_intersecting,
    normalise_geometry,
    point_in_polygon,
    polygon_bbox,
    polygon_centroid,
    polygons_overlap,
    rectangle_to_points,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _pts(*coords: tuple[float, float]) -> list[dict]:
    """Build a list of {x_pct, y_pct} dicts from (x, y) pairs."""
    return [{"x_pct": x, "y_pct": y} for x, y in coords]


# Square from (10,10) to (50,50)
SQUARE = _pts((10, 10), (50, 10), (50, 50), (10, 50))

# Small square (20,20)-(30,30) — inside SQUARE
INNER_SQUARE = _pts((20, 20), (30, 20), (30, 30), (20, 30))

# Square that partially overlaps SQUARE: (40,40)-(70,70)
OVERLAP_SQUARE = _pts((40, 40), (70, 40), (70, 70), (40, 70))

# Square completely outside SQUARE
OUTSIDE_SQUARE = _pts((60, 60), (90, 60), (90, 90), (60, 90))


# ---------------------------------------------------------------------------
# point_in_polygon
# ---------------------------------------------------------------------------

class TestPointInPolygon:
    def test_centre_of_square_is_inside(self):
        assert point_in_polygon(30, 30, SQUARE) is True

    def test_point_outside_is_false(self):
        assert point_in_polygon(5, 5, SQUARE) is False
        assert point_in_polygon(55, 55, SQUARE) is False

    def test_triangle_containment(self):
        triangle = _pts((0, 0), (100, 0), (50, 100))
        assert point_in_polygon(50, 40, triangle) is True
        assert point_in_polygon(5, 90, triangle) is False

    def test_non_convex_polygon(self):
        # L-shape: point inside the notch is outside
        l_shape = _pts((0, 0), (60, 0), (60, 40), (30, 40), (30, 60), (0, 60))
        assert point_in_polygon(15, 30, l_shape) is True   # left stem — inside
        assert point_in_polygon(45, 50, l_shape) is False  # notch — outside


# ---------------------------------------------------------------------------
# rectangle_to_points
# ---------------------------------------------------------------------------

class TestRectangleToPoints:
    def test_produces_four_points(self):
        geo = {"type": "rectangle", "x_pct": 10, "y_pct": 20, "width_pct": 30, "height_pct": 40}
        pts = rectangle_to_points(geo)
        assert len(pts) == 4

    def test_corners_are_correct(self):
        geo = {"type": "rectangle", "x_pct": 10, "y_pct": 20, "width_pct": 30, "height_pct": 40}
        pts = rectangle_to_points(geo)
        assert pts[0] == {"x_pct": 10, "y_pct": 20}   # top-left
        assert pts[1] == {"x_pct": 40, "y_pct": 20}   # top-right
        assert pts[2] == {"x_pct": 40, "y_pct": 60}   # bottom-right
        assert pts[3] == {"x_pct": 10, "y_pct": 60}   # bottom-left

    def test_zero_size_rectangle(self):
        geo = {"type": "rectangle", "x_pct": 50, "y_pct": 50, "width_pct": 0, "height_pct": 0}
        pts = rectangle_to_points(geo)
        assert all(p == {"x_pct": 50, "y_pct": 50} for p in pts)


# ---------------------------------------------------------------------------
# polygon_bbox
# ---------------------------------------------------------------------------

class TestPolygonBbox:
    def test_square_bbox(self):
        bbox = polygon_bbox(SQUARE)
        assert bbox == {"x_min_pct": 10, "y_min_pct": 10, "x_max_pct": 50, "y_max_pct": 50}

    def test_single_point_bbox(self):
        bbox = polygon_bbox(_pts((25, 75)))
        assert bbox["x_min_pct"] == bbox["x_max_pct"] == 25
        assert bbox["y_min_pct"] == bbox["y_max_pct"] == 75

    def test_empty_raises(self):
        with pytest.raises(ValueError, match="at least one point"):
            polygon_bbox([])


# ---------------------------------------------------------------------------
# polygon_centroid
# ---------------------------------------------------------------------------

class TestPolygonCentroid:
    def test_square_centroid_is_centre(self):
        cx, cy = polygon_centroid(SQUARE)
        assert math.isclose(cx, 30, abs_tol=1e-9)
        assert math.isclose(cy, 30, abs_tol=1e-9)

    def test_triangle_centroid(self):
        triangle = _pts((0, 0), (60, 0), (30, 60))
        cx, cy = polygon_centroid(triangle)
        assert math.isclose(cx, 30, abs_tol=1e-9)
        assert math.isclose(cy, 20, abs_tol=1e-9)

    def test_single_point_returns_that_point(self):
        cx, cy = polygon_centroid(_pts((42, 77)))
        assert cx == 42 and cy == 77

    def test_empty_raises(self):
        with pytest.raises(ValueError, match="at least one point"):
            polygon_centroid([])

    def test_degenerate_collinear_polygon_returns_mean(self):
        # All points on a horizontal line — area is 0, falls back to mean
        collinear = _pts((0, 50), (50, 50), (100, 50))
        cx, cy = polygon_centroid(collinear)
        assert math.isclose(cx, 50, abs_tol=1e-9)
        assert math.isclose(cy, 50, abs_tol=1e-9)


# ---------------------------------------------------------------------------
# canvas_bounds_check
# ---------------------------------------------------------------------------

class TestCanvasBoundsCheck:
    def test_all_in_bounds_passes(self):
        assert canvas_bounds_check(SQUARE) is True

    def test_zero_and_hundred_are_valid_boundaries(self):
        pts = _pts((0, 0), (100, 0), (100, 100), (0, 100))
        assert canvas_bounds_check(pts) is True

    def test_any_out_of_bounds_fails(self):
        pts = _pts((10, 10), (110, 10), (110, 50), (10, 50))
        assert canvas_bounds_check(pts) is False

    def test_negative_coordinate_fails(self):
        pts = _pts((-1, 10), (50, 10), (50, 50), (-1, 50))
        assert canvas_bounds_check(pts) is False

    def test_empty_list_is_vacuously_true(self):
        assert canvas_bounds_check([]) is True


# ---------------------------------------------------------------------------
# is_self_intersecting
# ---------------------------------------------------------------------------

class TestIsSelfIntersecting:
    def test_convex_square_is_not_self_intersecting(self):
        assert is_self_intersecting(SQUARE) is False

    def test_triangle_is_not_self_intersecting(self):
        triangle = _pts((0, 0), (50, 0), (25, 50))
        assert is_self_intersecting(triangle) is False

    def test_bowtie_polygon_is_self_intersecting(self):
        # Bowtie: vertices cross over
        bowtie = _pts((0, 0), (50, 50), (50, 0), (0, 50))
        assert is_self_intersecting(bowtie) is True

    def test_three_vertices_returns_false(self):
        assert is_self_intersecting(_pts((0, 0), (50, 0), (25, 50))) is False

    def test_two_vertices_returns_false(self):
        assert is_self_intersecting(_pts((0, 0), (50, 50))) is False


# ---------------------------------------------------------------------------
# polygons_overlap
# ---------------------------------------------------------------------------

class TestPolygonsOverlap:
    def test_nested_square_overlaps(self):
        assert polygons_overlap(SQUARE, INNER_SQUARE) is True

    def test_partially_overlapping_squares(self):
        assert polygons_overlap(SQUARE, OVERLAP_SQUARE) is True

    def test_non_overlapping_squares(self):
        assert polygons_overlap(SQUARE, OUTSIDE_SQUARE) is False

    def test_identical_squares_overlap(self):
        assert polygons_overlap(SQUARE, SQUARE) is True

    def test_touching_at_edge_is_implementation_defined(self):
        # Touching-edge behaviour is determined by floating-point; we just assert
        # no crash occurs and a bool is returned.
        edge_b = _pts((50, 10), (80, 10), (80, 50), (50, 50))
        result = polygons_overlap(SQUARE, edge_b)
        assert isinstance(result, bool)

    def test_polygon_with_degenerate_zero_length_edge_does_not_crash(self):
        # Duplicate vertex creates a zero-length edge — exercises the degenerate-edge guard.
        degenerate = _pts((10, 10), (10, 10), (50, 10), (50, 50), (10, 50))
        result = polygons_overlap(degenerate, INNER_SQUARE)
        assert isinstance(result, bool)


# ---------------------------------------------------------------------------
# normalise_geometry
# ---------------------------------------------------------------------------

class TestNormaliseGeometry:
    def test_rectangle_becomes_four_points(self):
        geo = {"type": "rectangle", "x_pct": 0, "y_pct": 0, "width_pct": 50, "height_pct": 50}
        pts = normalise_geometry(geo)
        assert len(pts) == 4
        assert pts[0] == {"x_pct": 0, "y_pct": 0}

    def test_polygon_returns_points_list(self):
        geo = {"type": "polygon", "points": [{"x_pct": 10, "y_pct": 10}, {"x_pct": 20, "y_pct": 10}]}
        pts = normalise_geometry(geo)
        assert len(pts) == 2
        assert pts[0] == {"x_pct": 10, "y_pct": 10}

    def test_unknown_type_raises(self):
        with pytest.raises(ValueError, match="Unknown geometry type"):
            normalise_geometry({"type": "circle"})

    def test_missing_type_raises(self):
        with pytest.raises(ValueError, match="Unknown geometry type"):
            normalise_geometry({})
