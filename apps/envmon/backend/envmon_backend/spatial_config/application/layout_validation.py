"""Application service for validating a draft spatial layout before publishing.

Loads zones and coordinates from the DAL, runs all blocking-error and warning
checks, and returns a :class:`ValidationResult`. Must not import ``fastapi``
(application-layer isolation enforced by test_architecture_boundaries).
"""

from __future__ import annotations

import asyncio
import json
import math
from dataclasses import dataclass, field

from envmon_backend.spatial_config.dal import coordinates as coordinates_dal
from envmon_backend.spatial_config.dal import zones as zones_dal
from envmon_backend.spatial_config.domain.geometry import (
    canvas_bounds_check,
    is_self_intersecting,
    normalise_geometry,
    point_in_polygon,
    polygon_bbox,
    polygons_overlap,
)


# ---------------------------------------------------------------------------
# Result types
# ---------------------------------------------------------------------------

@dataclass
class ValidationIssue:
    """A single validation finding with a severity classification.

    Args:
        severity: ``'blocking_error'``, ``'warning'``, or ``'suggestion'``.
        code: Machine-readable issue code (e.g. ``'L5_OUTSIDE_PARENT_ZONE'``).
        message: Human-readable description of the issue.
        subject_id: Optional zone_id or func_loc_id that the issue relates to.
    """

    severity: str
    code: str
    message: str
    subject_id: str | None = None


@dataclass
class ValidationResult:
    """Aggregated result of validating a draft layout.

    Args:
        issues: All issues found, regardless of severity.
    """

    issues: list[ValidationIssue] = field(default_factory=list)

    @property
    def blocking_errors(self) -> list[ValidationIssue]:
        """Return only the issues with severity ``'blocking_error'``."""
        return [i for i in self.issues if i.severity == "blocking_error"]

    @property
    def warnings(self) -> list[ValidationIssue]:
        """Return only the issues with severity ``'warning'``."""
        return [i for i in self.issues if i.severity == "warning"]

    @property
    def suggestions(self) -> list[ValidationIssue]:
        """Return only the issues with severity ``'suggestion'``."""
        return [i for i in self.issues if i.severity == "suggestion"]

    @property
    def is_publishable(self) -> bool:
        """Return True when there are no blocking errors."""
        return len(self.blocking_errors) == 0


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _zone_points(zone_row: dict) -> list[dict]:
    """Return normalised polygon points for a zone row dict."""
    geo = json.loads(zone_row["geometry_json"])
    return normalise_geometry(geo)


def _distance_point_to_segment(
    px: float, py: float,
    ax: float, ay: float,
    bx: float, by: float,
) -> float:
    """Return the minimum Euclidean distance from point P to segment AB."""
    dx, dy = bx - ax, by - ay
    length_sq = dx * dx + dy * dy
    if length_sq < 1e-12:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / length_sq))
    closest_x = ax + t * dx
    closest_y = ay + t * dy
    return math.hypot(px - closest_x, py - closest_y)


def _min_distance_to_boundary(x: float, y: float, points: list[dict]) -> float:
    """Return the minimum distance from (x, y) to any edge of the polygon."""
    n = len(points)
    min_dist = float("inf")
    for i in range(n):
        j = (i + 1) % n
        d = _distance_point_to_segment(
            x, y,
            points[i]["x_pct"], points[i]["y_pct"],
            points[j]["x_pct"], points[j]["y_pct"],
        )
        if d < min_dist:
            min_dist = d
    return min_dist


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def validate_draft_layout(
    token: str,
    plant_id: str,
    floor_id: str,
    revision_id: str,
) -> ValidationResult:
    """Validate a draft layout and return all issues found.

    Loads zones and coordinate mappings from the DAL, then runs blocking-error,
    warning, and suggestion checks in sequence. The result can be used to gate
    a publish attempt or to populate the ValidationPanel in the frontend.

    Args:
        token: Databricks access token from the proxy header.
        plant_id: SAP plant code.
        floor_id: Floor identifier.
        revision_id: UUID of the draft revision to validate.

    Returns:
        :class:`ValidationResult` containing all found issues.
    """
    result = ValidationResult()

    # --- Load data concurrently ---
    zone_rows, coord_rows = await asyncio.gather(
        zones_dal.fetch_zones(token, plant_id, floor_id, revision_id),
        coordinates_dal.fetch_studio_coordinates(token, plant_id, floor_id),
    )

    zone_by_id = {z["zone_id"]: z for z in zone_rows}

    # --- Blocking errors: L4 zone geometry checks ---
    for zone in zone_rows:
        zone_id = zone["zone_id"]
        geo = json.loads(zone["geometry_json"])
        pts = normalise_geometry(geo)

        if len(pts) < 3:
            result.issues.append(ValidationIssue(
                severity="blocking_error",
                code="L4_POLYGON_OPEN",
                message=f"Zone '{zone['zone_name']}' has fewer than 3 polygon points and cannot define an area.",
                subject_id=zone_id,
            ))
            continue  # Skip further geo checks for this zone — points are invalid

        if not canvas_bounds_check(pts):
            result.issues.append(ValidationIssue(
                severity="blocking_error",
                code="L4_OUTSIDE_CANVAS",
                message=f"Zone '{zone['zone_name']}' has points outside the canvas [0, 100]² bounds.",
                subject_id=zone_id,
            ))

        if is_self_intersecting(pts):
            result.issues.append(ValidationIssue(
                severity="blocking_error",
                code="L4_SELF_INTERSECTING",
                message=f"Zone '{zone['zone_name']}' polygon edges self-intersect.",
                subject_id=zone_id,
            ))

    # --- Blocking errors: L5 point checks ---
    for coord in coord_rows:
        func_loc_id = coord["func_loc_id"]
        parent_zone_id = coord.get("parent_zone_id")
        x = float(coord["x_pos"]) if coord.get("x_pos") is not None else None
        y = float(coord["y_pos"]) if coord.get("y_pos") is not None else None

        if not parent_zone_id:
            result.issues.append(ValidationIssue(
                severity="blocking_error",
                code="L5_NO_PARENT_ZONE",
                message=f"Location '{func_loc_id}' has no parent L4 zone assigned.",
                subject_id=func_loc_id,
            ))
            continue

        if parent_zone_id not in zone_by_id:
            # Zone was deleted from this draft but coordinate still references it
            result.issues.append(ValidationIssue(
                severity="blocking_error",
                code="L5_NO_PARENT_ZONE",
                message=f"Location '{func_loc_id}' references zone '{parent_zone_id}' which does not exist in this revision.",
                subject_id=func_loc_id,
            ))
            continue

        parent_zone = zone_by_id[parent_zone_id]

        if coord.get("floor_id") != parent_zone.get("floor_id"):
            result.issues.append(ValidationIssue(
                severity="blocking_error",
                code="L5_WRONG_FLOOR",
                message=(
                    f"Location '{func_loc_id}' floor '{coord.get('floor_id')}' differs from "
                    f"parent zone '{parent_zone['zone_name']}' floor '{parent_zone.get('floor_id')}'."
                ),
                subject_id=func_loc_id,
            ))

        if x is not None and y is not None:
            try:
                zone_pts = _zone_points(parent_zone)
            except (KeyError, ValueError, json.JSONDecodeError):
                continue  # Zone geometry is invalid — already caught above

            if len(zone_pts) >= 3 and not point_in_polygon(x, y, zone_pts):
                result.issues.append(ValidationIssue(
                    severity="blocking_error",
                    code="L5_OUTSIDE_PARENT_ZONE",
                    message=f"Location '{func_loc_id}' coordinates ({x:.1f}%, {y:.1f}%) lie outside its parent zone '{parent_zone['zone_name']}'.",
                    subject_id=func_loc_id,
                ))

    # --- Warnings: L4 zone overlap ---
    valid_zones = [z for z in zone_rows if _zone_has_valid_geometry(z)]
    for i in range(len(valid_zones)):
        for j in range(i + 1, len(valid_zones)):
            a, b = valid_zones[i], valid_zones[j]
            try:
                a_pts = _zone_points(a)
                b_pts = _zone_points(b)
            except (KeyError, ValueError, json.JSONDecodeError):
                continue
            if len(a_pts) >= 3 and len(b_pts) >= 3 and polygons_overlap(a_pts, b_pts):
                result.issues.append(ValidationIssue(
                    severity="warning",
                    code="L4_ZONES_OVERLAP",
                    message=f"Zones '{a['zone_name']}' and '{b['zone_name']}' overlap each other.",
                    subject_id=a["zone_id"],
                ))

    # --- Warnings: L4 zone has no L5 children ---
    zones_with_children = {coord.get("parent_zone_id") for coord in coord_rows if coord.get("parent_zone_id")}
    for zone in zone_rows:
        if zone["zone_id"] not in zones_with_children:
            result.issues.append(ValidationIssue(
                severity="warning",
                code="L4_ZONE_NO_CHILDREN",
                message=f"Zone '{zone['zone_name']}' has no L5 points assigned to it.",
                subject_id=zone["zone_id"],
            ))

    # --- Warnings: L5 near boundary ---
    for coord in coord_rows:
        parent_zone_id = coord.get("parent_zone_id")
        x = float(coord["x_pos"]) if coord.get("x_pos") is not None else None
        y = float(coord["y_pos"]) if coord.get("y_pos") is not None else None

        if not parent_zone_id or parent_zone_id not in zone_by_id or x is None or y is None:
            continue

        try:
            zone_pts = _zone_points(zone_by_id[parent_zone_id])
        except (KeyError, ValueError, json.JSONDecodeError):
            continue

        if len(zone_pts) < 3:
            continue

        if (point_in_polygon(x, y, zone_pts)
                and _min_distance_to_boundary(x, y, zone_pts) < NEAR_BOUNDARY_THRESHOLD_PCT):
            result.issues.append(ValidationIssue(
                severity="warning",
                code="L5_NEAR_BOUNDARY",
                message=(
                    f"Location '{coord['func_loc_id']}' is within {NEAR_BOUNDARY_THRESHOLD_PCT}% "
                    f"of its parent zone boundary."
                ),
                subject_id=coord["func_loc_id"],
            ))

    return result


NEAR_BOUNDARY_THRESHOLD_PCT: float = 2.0
"""L5 points within this many percentage units of their zone boundary trigger a warning."""


def _zone_has_valid_geometry(zone_row: dict) -> bool:
    """Return True if the zone row has parseable geometry with at least 3 points."""
    try:
        pts = _zone_points(zone_row)
        return len(pts) >= 3
    except (KeyError, ValueError, json.JSONDecodeError):
        return False
