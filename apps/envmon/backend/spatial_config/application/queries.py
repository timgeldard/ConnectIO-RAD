"""Read-facing application queries for spatial configuration data."""

from __future__ import annotations

import asyncio
from typing import Optional

from backend.schemas.em import FloorInfo, LocationMeta
from backend.spatial_config.dal import coordinates as coordinates_dal
from backend.spatial_config.dal import floors as floors_dal


async def list_floors(token: str, plant_id: str) -> list[FloorInfo]:
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
    rows = await coordinates_dal.fetch_location_coordinate(token, plant_id, func_loc_id)
    if not rows:
        return LocationMeta(func_loc_id=func_loc_id, plant_id=plant_id, is_mapped=False)

    row = rows[0]
    return LocationMeta(
        func_loc_id=row["func_loc_id"],
        plant_id=plant_id,
        floor_id=row["floor_id"],
        x_pos=float(row["x_pos"]),
        y_pos=float(row["y_pos"]),
        is_mapped=True,
    )
