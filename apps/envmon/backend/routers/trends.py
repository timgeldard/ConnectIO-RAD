"""
GET /api/em/mics   — distinct normalised MIC names for a plant/location
GET /api/em/trends — MIC time-series for a specific functional location
"""

from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Header, Query

from backend.schemas.em import TrendPoint, TrendResponse
from backend.utils.db import resolve_token, run_sql_async, sql_param
from backend.utils.em_config import (
    INSP_TYPES_SQL,
    LOT_TBL,
    POINT_TBL,
    RESULT_TBL,
)

router = APIRouter()


@router.get("/mics", response_model=list[str])
async def list_mics(
    plant_id: str = Query(..., description="SAP plant code"),
    func_loc_id: Optional[str] = Query(None),
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    token = resolve_token(x_forwarded_access_token, authorization)
    params = [sql_param("plant_id", plant_id)]

    if func_loc_id:
        params.append(sql_param("func_loc_id", func_loc_id))
        where_extra = "AND ip.FUNCTIONAL_LOCATION = :func_loc_id"
    else:
        date_from = (date.today() - timedelta(days=180)).isoformat()
        params.append(sql_param("date_from", date_from))
        where_extra = "AND lot.CREATED_DATE >= :date_from"

    sql = f"""
        SELECT DISTINCT UPPER(TRIM(r.MIC_NAME)) AS mic_name
        FROM {LOT_TBL} lot
        JOIN {POINT_TBL} ip
            ON lot.INSPECTION_LOT_ID = ip.INSPECTION_LOT_ID
        JOIN {RESULT_TBL} r
            ON ip.INSPECTION_LOT_ID = r.INSPECTION_LOT_ID
           AND ip.OPERATION_ID      = r.OPERATION_ID
           AND ip.SAMPLE_ID         = r.SAMPLE_ID
        WHERE lot.PLANT_ID          = :plant_id
          AND lot.INSPECTION_TYPE IN {INSP_TYPES_SQL}
          {where_extra}
          AND r.MIC_NAME IS NOT NULL
        ORDER BY mic_name
    """
    rows = await run_sql_async(token, sql, params)
    return [r["mic_name"] for r in rows if r.get("mic_name")]


@router.get("/trends", response_model=TrendResponse)
async def get_trends(
    plant_id: str = Query(..., description="SAP plant code"),
    func_loc_id: str = Query(...),
    mic_name: str = Query(...),
    window_days: int = Query(90, ge=1, le=365),
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    token = resolve_token(x_forwarded_access_token, authorization)
    date_from = (date.today() - timedelta(days=window_days)).isoformat()
    params = [
        sql_param("plant_id",    plant_id),
        sql_param("func_loc_id", func_loc_id),
        sql_param("mic_name",    mic_name.upper().strip()),
        sql_param("date_from",   date_from),
    ]
    sql = f"""
        SELECT
            lot.CREATED_DATE              AS inspection_date,
            UPPER(TRIM(r.MIC_NAME))       AS mic_name,
            r.QUANTITATIVE_RESULT         AS result_value,
            r.INSPECTION_RESULT_VALUATION AS valuation,
            r.UPPER_TOLERANCE             AS upper_limit,
            r.LOWER_TOLERANCE             AS lower_limit
        FROM {LOT_TBL} lot
        JOIN {POINT_TBL} ip
            ON lot.INSPECTION_LOT_ID = ip.INSPECTION_LOT_ID
        JOIN {RESULT_TBL} r
            ON ip.INSPECTION_LOT_ID = r.INSPECTION_LOT_ID
           AND ip.OPERATION_ID      = r.OPERATION_ID
           AND ip.SAMPLE_ID         = r.SAMPLE_ID
        WHERE lot.PLANT_ID             = :plant_id
          AND lot.INSPECTION_TYPE   IN {INSP_TYPES_SQL}
          AND ip.FUNCTIONAL_LOCATION   = :func_loc_id
          AND UPPER(TRIM(r.MIC_NAME))  = :mic_name
          AND lot.CREATED_DATE        >= :date_from
        ORDER BY lot.CREATED_DATE ASC
    """
    rows = await run_sql_async(token, sql, params)
    points = [
        TrendPoint(
            inspection_date=str(r["inspection_date"])[:10],
            mic_name=r["mic_name"],
            result_value=float(r["result_value"]) if r.get("result_value") is not None else None,
            valuation=r.get("valuation"),
            upper_limit=float(r["upper_limit"]) if r.get("upper_limit") is not None else None,
            lower_limit=float(r["lower_limit"]) if r.get("lower_limit") is not None else None,
        )
        for r in rows
    ]
    return TrendResponse(func_loc_id=func_loc_id, mic_name=mic_name, window_days=window_days, points=points)
