"""Domain model for a spatial studio L4 zone.

LayoutZone is an immutable value object that wraps a zone's geometry and
provides derived spatial operations (bbox, centroid, point-containment).
It delegates all geometry calculation to the sibling ``geometry`` module.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from envmon_backend.spatial_config.domain.geometry import (
    normalise_geometry,
    point_in_polygon,
    polygon_bbox,
    polygon_centroid,
)


@dataclass(frozen=True)
class LayoutZone:
    """Immutable value object for a spatial-studio L4 zone.

    Invariants:
        - zone_id, plant_id, floor_id, zone_name, revision_id are non-empty.
        - geometry_type is ``'polygon'`` or ``'rectangle'``.
        - geometry_json is valid JSON that deserialises to a dict.

    Args:
        zone_id: UUID for this zone.
        plant_id: SAP 4-character plant code.
        floor_id: Short floor identifier, e.g. F1.
        zone_name: Human-readable zone label.
        geometry_type: ``'polygon'`` or ``'rectangle'``.
        geometry_json: Canonical geometry serialised as a JSON string.
        revision_id: UUID of the owning layout revision.
    """

    zone_id: str
    plant_id: str
    floor_id: str
    zone_name: str
    geometry_type: str
    geometry_json: str
    revision_id: str

    _VALID_TYPES = frozenset({"polygon", "rectangle"})

    def __post_init__(self) -> None:
        """Validate zone invariants after construction.

        Raises:
            ValueError: If any required field is empty, the geometry type is
                unrecognised, or geometry_json is not valid JSON.
        """
        for field_name in ("zone_id", "plant_id", "floor_id", "zone_name", "revision_id"):
            if not getattr(self, field_name):
                raise ValueError(f"{field_name} must not be empty")
        if self.geometry_type not in self._VALID_TYPES:
            raise ValueError(
                f"geometry_type must be 'polygon' or 'rectangle', got '{self.geometry_type}'"
            )
        try:
            parsed = json.loads(self.geometry_json)
        except json.JSONDecodeError as exc:
            raise ValueError(f"geometry_json is not valid JSON: {exc}") from exc
        if not isinstance(parsed, dict):
            raise ValueError("geometry_json must be a JSON object")

    # ------------------------------------------------------------------
    # Derived geometry helpers
    # ------------------------------------------------------------------

    def _parsed_geo(self) -> dict[str, Any]:
        """Return the deserialised geometry dict."""
        return json.loads(self.geometry_json)

    def to_points(self) -> list[dict[str, float]]:
        """Return the zone boundary as a list of ``{x_pct, y_pct}`` dicts.

        Rectangles are expanded to their four corners; polygons are returned
        as-is from ``geometry_json["points"]``.
        """
        return normalise_geometry(self._parsed_geo())

    def bbox(self) -> dict[str, float]:
        """Return the axis-aligned bounding box as ``{x_min_pct, y_min_pct, x_max_pct, y_max_pct}``."""
        return polygon_bbox(self.to_points())

    def centroid(self) -> tuple[float, float]:
        """Return the zone centroid as ``(cx_pct, cy_pct)``."""
        return polygon_centroid(self.to_points())

    def contains_point(self, x_pct: float, y_pct: float) -> bool:
        """Return True if the canvas point ``(x_pct, y_pct)`` lies inside this zone."""
        return point_in_polygon(x_pct, y_pct, self.to_points())
