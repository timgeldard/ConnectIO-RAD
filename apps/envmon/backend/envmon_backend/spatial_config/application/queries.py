"""Read-facing application queries for spatial configuration data."""

from __future__ import annotations

import asyncio
from typing import Optional

from envmon_backend.schemas.em import FloorInfo, LocationMeta
from envmon_backend.spatial_config.dal import coordinates as coordinates_dal
from envmon_backend.spatial_config.dal import floors as floors_dal
from envmon_backend.spatial_config.dal.plant_geo import fetch_all_plant_geo


async def list_floors(token: str, plant_id: str) -> list[FloorInfo]:
    """Fetch floor metadata for a plant with mapped-location counts.

    Args:
        token: Databricks access token forwarded from the proxy header.
        plant_id: SAP plant identifier used to scope the query.

    Returns:
        Floor metadata rows with numeric SVG dimensions and zero location counts
        for floors that have no mapped locations.

    Raises:
        RuntimeError: Propagates DAL or SQL runtime failures.
        ValueError: Propagates invalid numeric SVG dimensions.
    """
    floors_rows, count_rows = await asyncio.gather(
        floors_dal.fetch_floors(token, plant_id),
        floors_dal.fetch_floor_location_counts(token, plant_id),
    )
    count_map = {r["floor_id"]: int(r["location_count"] or 0) for r in count_rows}
    return [
        FloorInfo(
            floor_id=r["floor_id"],
            floor_name=r["floor_name"],
            location_count=count_map.get(r["floor_id"], 0),
            svg_url=r.get("svg_url"),
            svg_width=float(r["svg_width"]) if r.get("svg_width") is not None else None,
            svg_height=float(r["svg_height"]) if r.get("svg_height") is not None else None,
        )
        for r in floors_rows
    ]


async def list_locations(
    token: str,
    plant_id: str,
    floor_id: Optional[str],
    mapped_only: bool,
) -> list[LocationMeta]:
    """Fetch functional locations with optional floor and mapping filters.

    Args:
        token: Databricks access token forwarded from the proxy header.
        plant_id: SAP plant identifier used to scope the query.
        floor_id: Optional floor identifier used to narrow results.
        mapped_only: Whether to return only locations that already have
            coordinate mappings.

    Returns:
        Location metadata rows with nullable coordinate values preserved.

    Raises:
        RuntimeError: Propagates DAL or SQL runtime failures.
        ValueError: Propagates invalid numeric coordinate values.
    """
    rows = await coordinates_dal.fetch_locations(token, plant_id, floor_id, mapped_only)
    return [
        LocationMeta(
            func_loc_id=r["func_loc_id"],
            func_loc_name=None,
            plant_id=plant_id,
            floor_id=r.get("floor_id"),
            x_pos=float(r["x_pos"]) if r.get("x_pos") is not None else None,
            y_pos=float(r["y_pos"]) if r.get("y_pos") is not None else None,
            is_mapped=bool(r.get("is_mapped", False)),
        )
        for r in rows
    ]


async def get_location_coordinate(token: str, plant_id: str, func_loc_id: str) -> LocationMeta:
    """Fetch one location's coordinate mapping or return an unmapped fallback.

    Args:
        token: Databricks access token forwarded from the proxy header.
        plant_id: SAP plant identifier used to scope the query.
        func_loc_id: Functional location identifier.

    Returns:
        Populated location metadata when a coordinate row exists, otherwise an
        unmapped ``LocationMeta`` with no floor or coordinates.

    Raises:
        RuntimeError: Propagates DAL or SQL runtime failures.
        ValueError: Propagates invalid numeric coordinate values.
    """
    rows = await coordinates_dal.fetch_location_coordinate(token, plant_id, func_loc_id)
    if not rows:
        return LocationMeta(func_loc_id=func_loc_id, plant_id=plant_id, is_mapped=False)

    row = rows[0]
    return LocationMeta(
        func_loc_id=row["func_loc_id"],
        plant_id=plant_id,
        floor_id=row["floor_id"],
        x_pos=float(row["x_pos"]) if row.get("x_pos") is not None else None,
        y_pos=float(row["y_pos"]) if row.get("y_pos") is not None else None,
        is_mapped=True,
    )


fetch_mapped_locations = coordinates_dal.fetch_mapped_locations
fetch_unmapped_locations = coordinates_dal.fetch_unmapped_locations

__all__ = [
    "coordinates_dal",
    "fetch_all_plant_geo",
    "fetch_mapped_locations",
    "fetch_unmapped_locations",
    "floors_dal",
    "get_location_coordinate",
    "list_floors",
    "list_locations",
]
