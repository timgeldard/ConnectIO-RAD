"""Pure geometry functions for spatial studio zone validation.

All functions operate on percentage-based coordinates (x_pct, y_pct ∈ [0, 100]).
Point dicts are expected to have ``x_pct`` and ``y_pct`` float fields.

No external dependencies — stdlib only. Must not import fastapi, shared_db,
dal modules, or any envmon schema/utils (enforced by test_architecture_boundaries).
"""

from __future__ import annotations

import math
from typing import Any


def point_in_polygon(x: float, y: float, points: list[dict[str, Any]]) -> bool:
    """Return True if (x, y) lies inside the polygon defined by *points*.

    Uses the ray-casting algorithm (even-odd rule). Points on the boundary may
    return True or False depending on floating-point rounding; treat boundary
    results as implementation-defined.

    Args:
        x: Query x-coordinate in percentage units.
        y: Query y-coordinate in percentage units.
        points: Ordered polygon vertices, each with ``x_pct`` and ``y_pct``.

    Returns:
        True when (x, y) is inside the polygon.
    """
    n = len(points)
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = points[i]["x_pct"], points[i]["y_pct"]
        xj, yj = points[j]["x_pct"], points[j]["y_pct"]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


def rectangle_to_points(geo: dict[str, Any]) -> list[dict[str, float]]:
    """Convert a rectangle geometry dict to a 4-point polygon (clockwise, top-left origin).

    Args:
        geo: Rectangle geometry with ``x_pct``, ``y_pct``, ``width_pct``, ``height_pct``.

    Returns:
        List of four ``{x_pct, y_pct}`` dicts: top-left, top-right, bottom-right, bottom-left.
    """
    x, y = geo["x_pct"], geo["y_pct"]
    w, h = geo["width_pct"], geo["height_pct"]
    return [
        {"x_pct": x,     "y_pct": y},
        {"x_pct": x + w, "y_pct": y},
        {"x_pct": x + w, "y_pct": y + h},
        {"x_pct": x,     "y_pct": y + h},
    ]


def polygon_bbox(points: list[dict[str, Any]]) -> dict[str, float]:
    """Return the axis-aligned bounding box of *points*.

    Args:
        points: Polygon vertices with ``x_pct`` and ``y_pct``.

    Returns:
        Dict with ``x_min_pct``, ``y_min_pct``, ``x_max_pct``, ``y_max_pct``.

    Raises:
        ValueError: If *points* is empty.
    """
    if not points:
        raise ValueError("polygon_bbox requires at least one point")
    xs = [p["x_pct"] for p in points]
    ys = [p["y_pct"] for p in points]
    return {
        "x_min_pct": min(xs),
        "y_min_pct": min(ys),
        "x_max_pct": max(xs),
        "y_max_pct": max(ys),
    }


def polygon_centroid(points: list[dict[str, Any]]) -> tuple[float, float]:
    """Return the centroid of a polygon using the shoelace formula.

    For degenerate polygons (zero area), returns the arithmetic mean of vertices.

    Args:
        points: Polygon vertices with ``x_pct`` and ``y_pct``.

    Returns:
        ``(cx, cy)`` centroid in percentage coordinates.

    Raises:
        ValueError: If *points* is empty.
    """
    n = len(points)
    if n == 0:
        raise ValueError("polygon_centroid requires at least one point")
    if n == 1:
        return points[0]["x_pct"], points[0]["y_pct"]

    area = 0.0
    cx = 0.0
    cy = 0.0
    for i in range(n):
        j = (i + 1) % n
        xi, yi = points[i]["x_pct"], points[i]["y_pct"]
        xj, yj = points[j]["x_pct"], points[j]["y_pct"]
        cross = xi * yj - xj * yi
        area += cross
        cx += (xi + xj) * cross
        cy += (yi + yj) * cross

    area /= 2.0
    if math.isclose(area, 0.0, abs_tol=1e-12):
        # Degenerate polygon: fall back to arithmetic mean of vertices
        return (
            sum(p["x_pct"] for p in points) / n,
            sum(p["y_pct"] for p in points) / n,
        )
    cx /= 6.0 * area
    cy /= 6.0 * area
    return cx, cy


def canvas_bounds_check(points: list[dict[str, Any]]) -> bool:
    """Return True if every vertex in *points* lies within [0, 100]².

    Args:
        points: Polygon vertices with ``x_pct`` and ``y_pct``.
    """
    return all(
        0.0 <= p["x_pct"] <= 100.0 and 0.0 <= p["y_pct"] <= 100.0
        for p in points
    )


def _segments_intersect(
    ax: float, ay: float, bx: float, by: float,
    cx: float, cy: float, dx: float, dy: float,
) -> bool:
    """Return True if segment AB properly intersects segment CD (endpoints excluded).

    Uses the cross-product orientation test. Collinear cases are treated as
    non-intersecting to avoid false positives on shared boundary points.
    """
    def _cross(ox: float, oy: float, px: float, py: float, qx: float, qy: float) -> float:
        return (px - ox) * (qy - oy) - (py - oy) * (qx - ox)

    d1 = _cross(cx, cy, dx, dy, ax, ay)
    d2 = _cross(cx, cy, dx, dy, bx, by)
    d3 = _cross(ax, ay, bx, by, cx, cy)
    d4 = _cross(ax, ay, bx, by, dx, dy)

    if ((d1 > 0 and d2 < 0) or (d1 < 0 and d2 > 0)) and \
       ((d3 > 0 and d4 < 0) or (d3 < 0 and d4 > 0)):
        return True
    return False


def is_self_intersecting(points: list[dict[str, Any]]) -> bool:
    """Return True if the polygon defined by *points* has any self-intersecting edges.

    Only proper crossings between non-adjacent edge pairs are counted.
    Adjacent edges sharing a vertex are not considered intersections.

    Args:
        points: Polygon vertices with ``x_pct`` and ``y_pct``.

    Returns:
        True if at least one pair of non-adjacent edges properly intersects.
    """
    n = len(points)
    if n < 4:
        return False  # Triangle or degenerate — cannot self-intersect

    for i in range(n):
        ax, ay = points[i]["x_pct"], points[i]["y_pct"]
        bx, by = points[(i + 1) % n]["x_pct"], points[(i + 1) % n]["y_pct"]
        for j in range(i + 2, n):
            # Skip the closing edge that shares the start vertex of edge 0
            if i == 0 and j == n - 1:
                continue
            cx, cy = points[j]["x_pct"], points[j]["y_pct"]
            dx, dy = points[(j + 1) % n]["x_pct"], points[(j + 1) % n]["y_pct"]
            if _segments_intersect(ax, ay, bx, by, cx, cy, dx, dy):
                return True
    return False


def _project_polygon(axis_x: float, axis_y: float, points: list[dict[str, Any]]) -> tuple[float, float]:
    """Project polygon vertices onto *axis* and return (min, max) scalar range."""
    dots = [p["x_pct"] * axis_x + p["y_pct"] * axis_y for p in points]
    return min(dots), max(dots)


def polygons_overlap(
    a_points: list[dict[str, Any]],
    b_points: list[dict[str, Any]],
) -> bool:
    """Return True if polygon A and polygon B overlap (Separating Axis Theorem).

    Tests all edge normals from both polygons. A separating axis found on any
    normal means the polygons do not overlap.

    Args:
        a_points: Vertices of polygon A with ``x_pct`` and ``y_pct``.
        b_points: Vertices of polygon B with ``x_pct`` and ``y_pct``.

    Returns:
        True when the polygons share interior area.
    """
    def _edges(pts: list[dict[str, Any]]) -> list[tuple[float, float]]:
        n = len(pts)
        return [
            (pts[(i + 1) % n]["x_pct"] - pts[i]["x_pct"],
             pts[(i + 1) % n]["y_pct"] - pts[i]["y_pct"])
            for i in range(n)
        ]

    for ex, ey in _edges(a_points) + _edges(b_points):
        nx, ny = -ey, ex  # Perpendicular axis (normal to edge)
        length = math.hypot(nx, ny)
        if length < 1e-12:
            continue  # Degenerate edge — skip
        nx, ny = nx / length, ny / length

        a_min, a_max = _project_polygon(nx, ny, a_points)
        b_min, b_max = _project_polygon(nx, ny, b_points)
        if a_max <= b_min or b_max <= a_min:
            return False  # Separating axis found

    return True


def normalise_geometry(geo: dict[str, Any]) -> list[dict[str, float]]:
    """Return the polygon point list for *geo* regardless of geometry type.

    For ``"type": "rectangle"`` geometries, delegates to :func:`rectangle_to_points`.
    For ``"type": "polygon"`` geometries, returns ``geo["points"]`` directly.

    Args:
        geo: Geometry dict with ``type`` and the corresponding fields.

    Returns:
        List of ``{x_pct, y_pct}`` dicts.

    Raises:
        ValueError: If *geo* has an unrecognised type.
    """
    geo_type = geo.get("type")
    if geo_type == "rectangle":
        return rectangle_to_points(geo)
    if geo_type == "polygon":
        return list(geo["points"])
    raise ValueError(f"Unknown geometry type '{geo_type}'; expected 'rectangle' or 'polygon'")
