"""
GET /api/em/lots          — inspection lots for a functional location
GET /api/em/lots/{lot_id} — MIC results for a specific lot
"""

from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Header, Query
from shared_auth import UserIdentity, require_user

from backend.schemas.em import InspectionLot, LotDetailResponse, MicResult
from backend.utils.db import run_sql_async, sql_param
from backend.utils.em_config import (
    INSP_TYPES_SQL,
    LOT_TBL,
    POINT_TBL,
    RESULT_TBL,
)

router = APIRouter()


def _lot_status(valuation: Optional[str], end_date) -> str:
    if end_date is None:
        return "PENDING"
    v = (valuation or "").upper()
    if v == "R":
        return "FAIL"
    if v == "A":
        return "PASS"
    return "NO_DATA"


@router.get("/lots", response_model=list[InspectionLot])
async def list_lots(
    plant_id: str = Query(..., description="SAP plant code"),
    func_loc_id: str = Query(...),
    time_window_days: int = Query(90, ge=1, le=365),
    user: UserIdentity = Depends(require_user),
):
    token = user.raw_token
    date_from = (date.today() - timedelta(days=time_window_days)).isoformat()
    params = [
        sql_param("plant_id",    plant_id),
        sql_param("func_loc_id", func_loc_id),
        sql_param("date_from",   date_from),
    ]
    sql = f"""
        SELECT
            lot.INSPECTION_LOT_ID    AS lot_id,
            ip.FUNCTIONAL_LOCATION   AS func_loc_id,
            lot.CREATED_DATE         AS inspection_start_date,
            lot.INSPECTION_END_DATE  AS inspection_end_date,
            MAX(CASE r.INSPECTION_RESULT_VALUATION
                WHEN 'R' THEN 'R' WHEN 'W' THEN 'W' WHEN 'A' THEN 'A' ELSE NULL END) AS valuation
        FROM {LOT_TBL} lot
        JOIN {POINT_TBL} ip ON lot.INSPECTION_LOT_ID = ip.INSPECTION_LOT_ID
        LEFT JOIN {RESULT_TBL} r
            ON ip.INSPECTION_LOT_ID = r.INSPECTION_LOT_ID
           AND ip.OPERATION_ID      = r.OPERATION_ID
           AND ip.SAMPLE_ID         = r.SAMPLE_ID
        WHERE lot.PLANT_ID             = :plant_id
          AND lot.INSPECTION_TYPE   IN {INSP_TYPES_SQL}
          AND ip.FUNCTIONAL_LOCATION   = :func_loc_id
          AND lot.CREATED_DATE        >= :date_from
        GROUP BY 1, 2, 3, 4
        ORDER BY lot.CREATED_DATE DESC
        LIMIT 200
    """
    rows = await run_sql_async(token, sql, params)
    return [
        InspectionLot(
            lot_id=r["lot_id"],
            func_loc_id=r["func_loc_id"],
            inspection_start_date=str(r["inspection_start_date"])[:10] if r.get("inspection_start_date") else None,
            inspection_end_date=str(r["inspection_end_date"])[:10] if r.get("inspection_end_date") else None,
            valuation=r.get("valuation"),
            status=_lot_status(r.get("valuation"), r.get("inspection_end_date")),
        )
        for r in rows
    ]


@router.get("/lots/{lot_id}", response_model=LotDetailResponse)
async def get_lot_detail(
    lot_id: str,
    plant_id: str = Query(..., description="SAP plant code"),
    user: UserIdentity = Depends(require_user),
):
    token = user.raw_token
    params = [sql_param("lot_id", lot_id), sql_param("plant_id", plant_id)]
    sql = f"""
        SELECT
            r.INSPECTION_LOT_ID           AS lot_id,
            r.MIC_ID                      AS mic_id,
            UPPER(TRIM(r.MIC_NAME))       AS mic_name,
            r.QUANTITATIVE_RESULT         AS result_value,
            r.INSPECTION_RESULT_VALUATION AS valuation,
            r.UPPER_TOLERANCE             AS upper_limit,
            r.LOWER_TOLERANCE             AS lower_limit
        FROM {RESULT_TBL} r
        WHERE r.INSPECTION_LOT_ID = :lot_id
          AND r.PLANT_ID          = :plant_id
        ORDER BY mic_name, r.SAMPLE_ID
    """
    rows = await run_sql_async(token, sql, params)
    return LotDetailResponse(
        lot_id=lot_id,
        mic_results=[
            MicResult(
                lot_id=r["lot_id"],
                mic_id=r.get("mic_id", ""),
                mic_name=r["mic_name"],
                result_value=float(r["result_value"]) if r.get("result_value") is not None else None,
                valuation=r.get("valuation"),
                upper_limit=float(r["upper_limit"]) if r.get("upper_limit") is not None else None,
                lower_limit=float(r["lower_limit"]) if r.get("lower_limit") is not None else None,
            )
            for r in rows
        ],
    )
