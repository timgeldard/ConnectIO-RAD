"""
Spatial Config bounded context — admin read/write endpoints for spatial data.

Endpoints:
    GET    /api/em/floors                     — list floors for a plant
    POST   /api/em/floors                     — add/update a floor definition (admin)
    DELETE /api/em/floors/{floor_id}          — remove a floor (admin)
    GET    /api/em/coordinates/unmapped       — locations with no coordinate mapping (admin)
    GET    /api/em/coordinates/mapped         — locations with coordinate mappings
    POST   /api/em/coordinates               — upsert a coordinate mapping (admin)
    DELETE /api/em/coordinates/{func_loc_id} — remove a coordinate mapping (admin)
    GET    /api/em/plant-geo                  — list plant lat/lon pins
    PUT    /api/em/plant-geo/{plant_id}       — upsert plant lat/lon (admin)
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from backend.schemas.em import (
    CoordinateUpsertRequest,
    CoordinateUpsertResponse,
    FloorInfo,
    LocationMeta,
)
from backend.spatial_config.dal import coordinates as coordinates_dal
from backend.spatial_config.dal import floors as floors_dal
from backend.spatial_config.dal import plant_geo as plant_geo_dal
from backend.spatial_config.domain.coordinate import LocationCoordinate
from backend.spatial_config.domain.plant_geo import PlantGeo
from shared_auth import UserIdentity, require_proxy_user

router = APIRouter()


# ---------------------------------------------------------------------------
# Request/response models local to this context
# ---------------------------------------------------------------------------

class FloorCreateRequest(BaseModel):
    """Request body for creating or updating a floor definition."""

    plant_id: str
    floor_id: str
    floor_name: str
    svg_url: Optional[str] = None
    svg_width: Optional[float] = None
    svg_height: Optional[float] = None
    sort_order: int = 1


class PlantGeoUpsert(BaseModel):
    """Request body for setting a plant's geographic pin coordinates."""

    lat: float
    lon: float


class PlantGeoEntry(BaseModel):
    """Plant geographic pin as returned by the API."""

    plant_id: str
    lat: float
    lon: float
    updated_at: Optional[str] = None
    updated_by: Optional[str] = None


# ---------------------------------------------------------------------------
# Floors (admin writes — spatial_config owns em_plant_floor)
# ---------------------------------------------------------------------------

@router.post("/floors", response_model=FloorInfo, status_code=201)
async def add_floor(
    body: FloorCreateRequest,
    user: UserIdentity = Depends(require_proxy_user),
):
    """Upsert a floor definition. Idempotent: updates metadata if floor_id already exists."""
    token = user.raw_token
    await floors_dal.upsert_floor(
        token,
        body.plant_id, body.floor_id, body.floor_name,
        body.svg_url, body.svg_width, body.svg_height, body.sort_order,
    )
    return FloorInfo(
        floor_id=body.floor_id,
        floor_name=body.floor_name,
        location_count=0,
        svg_url=body.svg_url,
        svg_width=body.svg_width,
        svg_height=body.svg_height,
    )


@router.delete("/floors/{floor_id}", status_code=204)
async def delete_floor(
    floor_id: str,
    plant_id: str = Query(...),
    user: UserIdentity = Depends(require_proxy_user),
):
    """Remove a floor definition. Coordinate mappings for this floor are not automatically removed."""
    token = user.raw_token
    await floors_dal.delete_floor(token, plant_id, floor_id)


# ---------------------------------------------------------------------------
# Coordinate mappings (admin — em_location_coordinates)
# ---------------------------------------------------------------------------

@router.get("/coordinates/unmapped", response_model=list[LocationMeta])
async def list_unmapped(
    plant_id: str = Query(..., description="SAP plant code"),
    user: UserIdentity = Depends(require_proxy_user),
):
    """Return functional locations that have inspection history but no coordinate mapping."""
    token = user.raw_token
    rows = await coordinates_dal.fetch_unmapped_locations(token, plant_id)
    return [
        LocationMeta(func_loc_id=r["func_loc_id"], func_loc_name=None,
                     plant_id=plant_id, floor_id=None, x_pos=None, y_pos=None, is_mapped=False)
        for r in rows
    ]


@router.get("/coordinates/mapped", response_model=list[LocationMeta])
async def list_mapped(
    plant_id: str = Query(..., description="SAP plant code"),
    user: UserIdentity = Depends(require_proxy_user),
):
    """Return all coordinate-mapped locations for a plant."""
    token = user.raw_token
    rows = await coordinates_dal.fetch_mapped_locations(token, plant_id)
    return [
        LocationMeta(func_loc_id=r["func_loc_id"], func_loc_name=None,
                     plant_id=plant_id, floor_id=r["floor_id"],
                     x_pos=float(r["x_pos"]), y_pos=float(r["y_pos"]), is_mapped=True)
        for r in rows
    ]


@router.post("/coordinates", response_model=CoordinateUpsertResponse)
async def upsert_coordinate(
    body: CoordinateUpsertRequest,
    user: UserIdentity = Depends(require_proxy_user),
):
    """Map a functional location to X/Y coordinates on a floor plan. Validates bounds before write."""
    token = user.raw_token
    try:
        coord = LocationCoordinate(
            func_loc_id=body.func_loc_id,
            floor_id=body.floor_id,
            x_pct=body.x_pos,
            y_pct=body.y_pos,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    await coordinates_dal.upsert_coordinate(
        token, body.plant_id, coord.func_loc_id, coord.floor_id, coord.x_pct, coord.y_pct
    )
    return CoordinateUpsertResponse(
        func_loc_id=coord.func_loc_id,
        floor_id=coord.floor_id,
        x_pos=coord.x_pct,
        y_pos=coord.y_pct,
        saved=True,
    )


@router.delete("/coordinates/{func_loc_id}", status_code=204)
async def delete_coordinate(
    func_loc_id: str,
    plant_id: str = Query(..., description="SAP plant code"),
    user: UserIdentity = Depends(require_proxy_user),
):
    """Remove a coordinate mapping for a functional location."""
    token = user.raw_token
    await coordinates_dal.delete_coordinate(token, plant_id, func_loc_id)


# ---------------------------------------------------------------------------
# Plant geographic pins (admin — em_plant_geo)
# ---------------------------------------------------------------------------

@router.get("/plant-geo", response_model=list[PlantGeoEntry])
async def list_plant_geo(
    user: UserIdentity = Depends(require_proxy_user),
):
    """Return all configured plant geographic pins."""
    token = user.raw_token
    rows = await plant_geo_dal.fetch_all_plant_geo(token)
    return [
        PlantGeoEntry(
            plant_id=r["plant_id"],
            lat=float(r["lat"]),
            lon=float(r["lon"]),
            updated_at=str(r["updated_at"]) if r.get("updated_at") else None,
            updated_by=r.get("updated_by"),
        )
        for r in rows
    ]


@router.put("/plant-geo/{plant_id}", response_model=PlantGeoEntry)
async def upsert_plant_geo(
    plant_id: str,
    body: PlantGeoUpsert,
    user: UserIdentity = Depends(require_proxy_user),
):
    """Update a plant's geographic pin coordinates. Validates WGS-84 bounds before write."""
    token = user.raw_token
    try:
        geo = PlantGeo(plant_id=plant_id, lat=body.lat, lon=body.lon)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    await plant_geo_dal.upsert_plant_geo(token, geo.plant_id, geo.lat, geo.lon)
    return PlantGeoEntry(plant_id=geo.plant_id, lat=geo.lat, lon=geo.lon)
