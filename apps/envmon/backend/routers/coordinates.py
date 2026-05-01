"""
GET    /api/em/coordinates/unmapped      — functional locations with no X/Y entry for a plant
GET    /api/em/coordinates/mapped        — functional locations that have coordinates for a plant
POST   /api/em/coordinates              — upsert a coordinate mapping (admin)
DELETE /api/em/coordinates/{func_loc_id} — remove a coordinate mapping (admin)
GET    /api/em/locations/{id}/summary   — location detail with MICs + recent lots
"""

from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Header, Query
from shared_auth import UserIdentity, require_proxy_user

from backend.schemas.em import CoordinateUpsertRequest, CoordinateUpsertResponse, LocationMeta, LocationSummary
from backend.utils.db import run_sql_async, sql_param
from backend.utils.em_config import (
    COORD_TBL,
    INSP_TYPES_SQL,
    LOT_TBL,
    POINT_TBL,
    RESULT_TBL,
)

router = APIRouter()


@router.get("/coordinates/unmapped", response_model=list[LocationMeta])
async def list_unmapped(
    plant_id: str = Query(..., description="SAP plant code"),
    user: UserIdentity = Depends(require_proxy_user),
):
    token = user.raw_token
    params = [sql_param("plant_id", plant_id)]
    sql = f"""
        WITH active_locs AS (
            SELECT DISTINCT ip.FUNCTIONAL_LOCATION AS func_loc_id
            FROM {LOT_TBL} lot
            JOIN {POINT_TBL} ip ON lot.INSPECTION_LOT_ID = ip.INSPECTION_LOT_ID
            WHERE lot.PLANT_ID         = :plant_id
              AND lot.INSPECTION_TYPE IN {INSP_TYPES_SQL}
              AND ip.FUNCTIONAL_LOCATION IS NOT NULL
        )
        SELECT al.func_loc_id
        FROM active_locs al
        LEFT JOIN {COORD_TBL} c
            ON al.func_loc_id = c.func_loc_id
           AND c.plant_id     = :plant_id
        WHERE c.func_loc_id IS NULL
        ORDER BY al.func_loc_id
    """
    rows = await run_sql_async(token, sql, params)
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
    token = user.raw_token
    params = [sql_param("plant_id", plant_id)]
    sql = f"""
        SELECT func_loc_id, floor_id, x_pos, y_pos
        FROM {COORD_TBL}
        WHERE plant_id = :plant_id
        ORDER BY floor_id, func_loc_id
    """
    rows = await run_sql_async(token, sql, params)
    return [
        LocationMeta(func_loc_id=r["func_loc_id"], func_loc_name=None,
                     plant_id=plant_id, floor_id=r["floor_id"],
                     x_pos=float(r["x_pos"]), y_pos=float(r["y_pos"]), is_mapped=True)
        for r in rows
    ]


@router.get("/locations/{func_loc_id}/summary", response_model=LocationSummary)
async def get_location_summary(
    func_loc_id: str,
    plant_id: str = Query(..., description="SAP plant code"),
    user: UserIdentity = Depends(require_proxy_user),
):
    token = user.raw_token

    meta_params = [sql_param("func_loc_id", func_loc_id), sql_param("plant_id", plant_id)]
    meta_sql = f"""
        SELECT func_loc_id, floor_id, x_pos, y_pos
        FROM {COORD_TBL}
        WHERE func_loc_id = :func_loc_id AND plant_id = :plant_id
    """
    meta_rows = await run_sql_async(token, meta_sql, meta_params)
    if meta_rows:
        r = meta_rows[0]
        meta = LocationMeta(func_loc_id=r["func_loc_id"], plant_id=plant_id,
                            floor_id=r["floor_id"], x_pos=float(r["x_pos"]),
                            y_pos=float(r["y_pos"]), is_mapped=True)
    else:
        meta = LocationMeta(func_loc_id=func_loc_id, plant_id=plant_id, is_mapped=False)

    date_from = (date.today() - timedelta(days=180)).isoformat()
    shared_params = [
        sql_param("func_loc_id", func_loc_id),
        sql_param("plant_id", plant_id),
        sql_param("date_from", date_from),
    ]
    mic_sql = f"""
        SELECT DISTINCT UPPER(TRIM(r.MIC_NAME)) AS mic_name
        FROM {LOT_TBL} lot
        JOIN {POINT_TBL} ip ON lot.INSPECTION_LOT_ID = ip.INSPECTION_LOT_ID
        JOIN {RESULT_TBL} r
            ON ip.INSPECTION_LOT_ID = r.INSPECTION_LOT_ID
           AND ip.OPERATION_ID      = r.OPERATION_ID
           AND ip.SAMPLE_ID         = r.SAMPLE_ID
        WHERE lot.PLANT_ID             = :plant_id
          AND lot.INSPECTION_TYPE IN {INSP_TYPES_SQL}
          AND ip.FUNCTIONAL_LOCATION   = :func_loc_id
          AND lot.CREATED_DATE        >= :date_from
    """
    mic_rows = await run_sql_async(token, mic_sql, shared_params)
    mics = [r["mic_name"] for r in mic_rows if r.get("mic_name")]

    from backend.routers.lots import _lot_status
    lot_sql = f"""
        SELECT
            lot.INSPECTION_LOT_ID  AS lot_id,
            ip.FUNCTIONAL_LOCATION AS func_loc_id,
            lot.CREATED_DATE       AS inspection_start_date,
            lot.INSPECTION_END_DATE AS inspection_end_date,
            MAX(CASE r.INSPECTION_RESULT_VALUATION
                WHEN 'R' THEN 'R' WHEN 'W' THEN 'W' WHEN 'A' THEN 'A' ELSE NULL END) AS valuation
        FROM {LOT_TBL} lot
        JOIN {POINT_TBL} ip ON lot.INSPECTION_LOT_ID = ip.INSPECTION_LOT_ID
        LEFT JOIN {RESULT_TBL} r
            ON ip.INSPECTION_LOT_ID = r.INSPECTION_LOT_ID
           AND ip.OPERATION_ID      = r.OPERATION_ID
           AND ip.SAMPLE_ID         = r.SAMPLE_ID
        WHERE lot.PLANT_ID             = :plant_id
          AND lot.INSPECTION_TYPE IN {INSP_TYPES_SQL}
          AND ip.FUNCTIONAL_LOCATION   = :func_loc_id
          AND lot.CREATED_DATE        >= :date_from
        GROUP BY 1, 2, 3, 4
        ORDER BY 3 DESC
        LIMIT 5
    """
    lot_rows = await run_sql_async(token, lot_sql, shared_params)
    recent_lots = [
        {
            "lot_id": r["lot_id"],
            "func_loc_id": r["func_loc_id"],
            "inspection_start_date": str(r["inspection_start_date"])[:10] if r.get("inspection_start_date") else None,
            "inspection_end_date":   str(r["inspection_end_date"])[:10]   if r.get("inspection_end_date")   else None,
            "valuation": r["valuation"],
            "status": _lot_status(r["valuation"], r.get("inspection_end_date")),
        }
        for r in lot_rows
    ]

    return LocationSummary(meta=meta, mics=mics, recent_lots=recent_lots)


@router.delete("/coordinates/{func_loc_id}", status_code=204)
async def delete_coordinate(
    func_loc_id: str,
    plant_id: str = Query(..., description="SAP plant code"),
    user: UserIdentity = Depends(require_proxy_user),
):
    token = user.raw_token
    params = [sql_param("func_loc_id", func_loc_id), sql_param("plant_id", plant_id)]
    sql = f"DELETE FROM {COORD_TBL} WHERE func_loc_id = :func_loc_id AND plant_id = :plant_id"
    await run_sql_async(token, sql, params)


@router.post("/coordinates", response_model=CoordinateUpsertResponse)
async def upsert_coordinate(
    body: CoordinateUpsertRequest,
    user: UserIdentity = Depends(require_proxy_user),
):
    token = user.raw_token
    params = [
        sql_param("plant_id",    body.plant_id),
        sql_param("func_loc_id", body.func_loc_id),
        sql_param("floor_id",    body.floor_id),
        sql_param("x_pos",       body.x_pos),
        sql_param("y_pos",       body.y_pos),
    ]
    sql = f"""
        MERGE INTO {COORD_TBL} AS target
        USING (
            SELECT
                :plant_id               AS plant_id,
                :func_loc_id            AS func_loc_id,
                :floor_id               AS floor_id,
                CAST(:x_pos AS DOUBLE)  AS x_pos,
                CAST(:y_pos AS DOUBLE)  AS y_pos
        ) AS source
        ON target.func_loc_id = source.func_loc_id
       AND target.plant_id    = source.plant_id
        WHEN MATCHED THEN UPDATE SET
            target.floor_id   = source.floor_id,
            target.x_pos      = source.x_pos,
            target.y_pos      = source.y_pos,
            target.updated_by = CURRENT_USER(),
            target.updated_at = CURRENT_TIMESTAMP()
        WHEN NOT MATCHED THEN INSERT (
            plant_id, func_loc_id, floor_id, x_pos, y_pos, updated_by, updated_at
        ) VALUES (
            source.plant_id, source.func_loc_id, source.floor_id,
            source.x_pos, source.y_pos, CURRENT_USER(), CURRENT_TIMESTAMP()
        )
    """
    await run_sql_async(token, sql, params)
    return CoordinateUpsertResponse(
        func_loc_id=body.func_loc_id, floor_id=body.floor_id,
        x_pos=body.x_pos, y_pos=body.y_pos, saved=True,
    )
