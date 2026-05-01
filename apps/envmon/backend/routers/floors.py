"""
GET  /api/em/floors          — list floors for a plant (from em_plant_floor table)
POST /api/em/floors          — add a floor for a plant (admin)
DELETE /api/em/floors/{id}   — remove a floor for a plant (admin)
GET  /api/em/locations       — functional locations for a plant/floor
GET  /api/em/locations/{id}/summary — location detail with MICs + recent lots
"""

from typing import Optional

from fastapi import APIRouter, Depends, Header, Query
from pydantic import BaseModel

from backend.schemas.em import FloorInfo, LocationMeta
from backend.utils.db import run_sql_async, sql_param
from shared_auth import UserIdentity, require_user
from backend.utils.em_config import (
    COORD_TBL,
    FLOOR_TBL,
    INSP_TYPES_SQL,
    LOT_TBL,
    POINT_TBL,
)

router = APIRouter()


class FloorCreateRequest(BaseModel):
    plant_id: str
    floor_id: str
    floor_name: str
    svg_url: Optional[str] = None
    svg_width: Optional[float] = None
    svg_height: Optional[float] = None
    sort_order: int = 1


@router.get("/floors", response_model=list[FloorInfo])
async def list_floors(
    plant_id: str = Query(..., description="SAP plant code"),
    user: UserIdentity = Depends(require_user),
):
    token = user.raw_token
    params = [sql_param("plant_id", plant_id)]

    # Floor definitions from em_plant_floor
    floor_sql = f"""
        SELECT floor_id, floor_name, svg_url, svg_width, svg_height
        FROM {FLOOR_TBL}
        WHERE plant_id = :plant_id
        ORDER BY sort_order, floor_id
    """
    # Location counts per floor for this plant
    count_sql = f"""
        SELECT floor_id, COUNT(DISTINCT func_loc_id) AS location_count
        FROM {COORD_TBL}
        WHERE plant_id = :plant_id
        GROUP BY floor_id
    """

    floors_rows, count_rows = await _run_both(token, floor_sql, count_sql, params)
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


async def _run_both(token, sql1, sql2, params):
    import asyncio
    return await asyncio.gather(
        run_sql_async(token, sql1, params),
        run_sql_async(token, sql2, params),
    )


@router.post("/floors", response_model=FloorInfo, status_code=201)
async def add_floor(
    body: FloorCreateRequest,
    user: UserIdentity = Depends(require_user),
):
    token = user.raw_token
    params = [
        sql_param("plant_id",   body.plant_id),
        sql_param("floor_id",   body.floor_id),
        sql_param("floor_name", body.floor_name),
        sql_param("svg_url",    body.svg_url or ""),
        sql_param("svg_width",  body.svg_width if body.svg_width is not None else 0.0),
        sql_param("svg_height", body.svg_height if body.svg_height is not None else 0.0),
        sql_param("sort_order", body.sort_order),
    ]
    sql = f"""
        MERGE INTO {FLOOR_TBL} AS t
        USING (SELECT
            :plant_id   AS plant_id,
            :floor_id   AS floor_id,
            :floor_name AS floor_name,
            NULLIF(:svg_url, '')    AS svg_url,
            NULLIF(:svg_width,  0)  AS svg_width,
            NULLIF(:svg_height, 0)  AS svg_height,
            :sort_order AS sort_order,
            CURRENT_TIMESTAMP() AS created_at
        ) AS s
        ON t.plant_id = s.plant_id AND t.floor_id = s.floor_id
        WHEN MATCHED THEN UPDATE SET
            floor_name = s.floor_name,
            svg_url    = s.svg_url,
            svg_width  = s.svg_width,
            svg_height = s.svg_height,
            sort_order = s.sort_order
        WHEN NOT MATCHED THEN INSERT (plant_id, floor_id, floor_name, svg_url, svg_width, svg_height, sort_order, created_at)
            VALUES (s.plant_id, s.floor_id, s.floor_name, s.svg_url, s.svg_width, s.svg_height, s.sort_order, s.created_at)
    """
    await run_sql_async(token, sql, params)
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
    user: UserIdentity = Depends(require_user),
):
    token = user.raw_token
    params = [sql_param("plant_id", plant_id), sql_param("floor_id", floor_id)]
    sql = f"DELETE FROM {FLOOR_TBL} WHERE plant_id = :plant_id AND floor_id = :floor_id"
    await run_sql_async(token, sql, params)


@router.get("/locations", response_model=list[LocationMeta])
async def list_locations(
    plant_id: str = Query(..., description="SAP plant code"),
    floor_id: Optional[str] = Query(default=None),
    mapped_only: bool = Query(default=False),
    user: UserIdentity = Depends(require_user),
):
    token = user.raw_token
    params = [sql_param("plant_id", plant_id)]

    floor_filter = ""
    if floor_id:
        params.append(sql_param("floor_id", floor_id))
        floor_filter = "AND c.floor_id = :floor_id"

    mapped_filter = "WHERE c.func_loc_id IS NOT NULL" if mapped_only else ""

    sql = f"""
        WITH known_locs AS (
            SELECT DISTINCT ip.FUNCTIONAL_LOCATION AS func_loc_id
            FROM {LOT_TBL} lot
            JOIN {POINT_TBL} ip ON lot.INSPECTION_LOT_ID = ip.INSPECTION_LOT_ID
            WHERE lot.PLANT_ID = :plant_id
              AND lot.INSPECTION_TYPE IN {INSP_TYPES_SQL}
              AND ip.FUNCTIONAL_LOCATION IS NOT NULL
        )
        SELECT
            kl.func_loc_id,
            c.floor_id,
            c.x_pos,
            c.y_pos,
            CASE WHEN c.func_loc_id IS NOT NULL THEN TRUE ELSE FALSE END AS is_mapped
        FROM known_locs kl
        LEFT JOIN {COORD_TBL} c
            ON kl.func_loc_id = c.func_loc_id
           AND c.plant_id = :plant_id
           {floor_filter}
        {mapped_filter}
        ORDER BY kl.func_loc_id
    """
    rows = await run_sql_async(token, sql, params)
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
