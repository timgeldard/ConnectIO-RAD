"""
GET  /api/em/plant-geo          — list all configured plant map pins
PUT  /api/em/plant-geo/{plant_id} — upsert lat/lon for one plant (admin only)
"""
from typing import Optional

from fastapi import APIRouter, Depends, Header
from pydantic import BaseModel
from shared_auth import UserIdentity, require_proxy_user

from backend.utils.db import run_sql_async, sql_param
from backend.utils.em_config import PLANT_GEO_TBL

router = APIRouter()


class PlantGeoUpsert(BaseModel):
    lat: float
    lon: float


class PlantGeoEntry(BaseModel):
    plant_id: str
    lat: float
    lon: float
    updated_at: Optional[str] = None
    updated_by: Optional[str] = None


@router.get("/plant-geo", response_model=list[PlantGeoEntry])
async def list_plant_geo(
    user: UserIdentity = Depends(require_proxy_user),
):
    token = user.raw_token
    rows = await run_sql_async(
        token,
        f"SELECT plant_id, lat, lon, updated_at, updated_by FROM {PLANT_GEO_TBL} ORDER BY plant_id",
    )
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
    token = user.raw_token
    params = [
        sql_param("plant_id", plant_id),
        sql_param("lat",      str(body.lat)),
        sql_param("lon",      str(body.lon)),
    ]
    await run_sql_async(
        token,
        f"""
        MERGE INTO {PLANT_GEO_TBL} AS t
        USING (SELECT :plant_id AS plant_id, CAST(:lat AS DOUBLE) AS lat, CAST(:lon AS DOUBLE) AS lon) AS s
        ON t.plant_id = s.plant_id
        WHEN MATCHED THEN
            UPDATE SET lat = s.lat, lon = s.lon, updated_at = CURRENT_TIMESTAMP()
        WHEN NOT MATCHED THEN
            INSERT (plant_id, lat, lon, updated_at)
            VALUES (s.plant_id, s.lat, s.lon, CURRENT_TIMESTAMP())
        """,
        params,
    )
    return PlantGeoEntry(plant_id=plant_id, lat=body.lat, lon=body.lon)
