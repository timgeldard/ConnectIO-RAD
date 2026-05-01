"""
GET /api/em/heatmap — heatmap data for a floor with advanced analytics.

Features:
- Deterministic/Continuous modes
- Time-travel historical view (as_of_date)
- MIC-specific filtering and dynamic decay tuning
- Early Warning via Statistical Process Control (SPC)
"""

import math
import os
from collections import defaultdict
from datetime import date, timedelta
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Header, Query

from backend.schemas.em import HeatmapResponse, MarkerData
from backend.utils.db import run_sql_async, sql_param
from shared_auth import UserIdentity, require_proxy_user
from backend.utils.em_config import (
    COORD_TBL,
    INSP_TYPES_SQL,
    LOT_TBL,
    MIC_DECAY_RATES,
    POINT_TBL,
    RESULT_TBL,
)

router = APIRouter()

def _get_default_lambda() -> float:
    raw = os.environ.get("EM_DEFAULT_DECAY_LAMBDA", "0.1").strip()
    try:
        val = float(raw)
        return min(max(val, 0.0), 1.0)
    except (ValueError, TypeError):
        return 0.1

_DEFAULT_LAMBDA = _get_default_lambda()


def _risk_score(rows: list[dict], today: date, decay_lambda: float) -> float:
    score = 0.0
    for r in rows:
        val = (r.get("valuation") or "").upper()
        mic_name = (r.get("mic_name") or "").upper().strip()
        created_str = r.get("lot_date")
        if not created_str:
            continue
        
        try:
            created = date.fromisoformat(str(created_str))
        except ValueError:
            continue
            
        dt = (today - created).days
        if dt < 0: dt = 0
        
        # Base weight for a failure
        weight = 10.0 if val in ("R", "REJ", "REJECT") else 0.0
        
        # Adjust weight by MIC decay rate if specified
        mic_lambda = decay_lambda
        if mic_name in MIC_DECAY_RATES:
            mic_lambda = MIC_DECAY_RATES[mic_name]
            
        score += weight * math.exp(-mic_lambda * dt)
    return score


def _detect_early_warning(rows: list[dict]) -> bool:
    """
    Check for early-warning patterns in recent observation data.
    
    Current implementation flags if the last 3 results show a continuous
    increase in quantitative result value (trend towards a limit).
    """
    if len(rows) < 3:
        return False
        
    vals = []
    for r in rows:
        v = r.get("quantitative_result")
        if v is not None:
            try:
                vals.append(float(v))
            except (ValueError, TypeError):
                continue
    
    if len(vals) < 3:
        return False
        
    # Check last 3: x[n] > x[n-1] > x[n-2]
    last3 = vals[-3:]
    return last3[2] > last3[1] > last3[0]


@router.get("/heatmap", response_model=HeatmapResponse)
async def get_heatmap(
    plant_id: str = Query(...),
    floor_id: str = Query(...),
    user: UserIdentity = Depends(require_proxy_user),
    mics: Optional[list[str]] = Query(None),
    time_window_days: int = Query(30, ge=7, le=365),
    decay_lambda: Optional[float] = Query(None, ge=0.0, le=1.0),
    as_of_date: Optional[date] = Query(None),
):
    """
    Generate heatmap data for a facility floor plan.
    
    Supports two modes:
    1. 'deterministic': Displays the current status of each inspection point based on 
       the most recent results.
    2. 'continuous': Calculates a risk score for each point using exponential time 
       decay (lambda), allowing for a historical "time-travel" view.
       
    The algorithm also detects early-warning SPC patterns (e.g., 3 points increasing 
    towards a limit) to flag locations before they fail.
    """
    token = user.raw_token

    reference_date = as_of_date or date.today()
    date_from = (reference_date - timedelta(days=time_window_days)).isoformat()
    date_to = reference_date.isoformat()
    applied_lambda = decay_lambda if decay_lambda is not None else _DEFAULT_LAMBDA

    params = [
        sql_param("plant_id",  plant_id),
        sql_param("floor_id",  floor_id),
        sql_param("date_from", date_from),
        sql_param("date_to",   date_to),
    ]

    mic_filter = ""
    if mics:
        norm_mics = [m.upper().strip() for m in mics]
        for idx, m in enumerate(norm_mics):
            params.append(sql_param(f"mic_{idx}", m))
        placeholders = ", ".join(f":mic_{idx}" for idx in range(len(norm_mics)))
        mic_filter = f"AND UPPER(TRIM(r.MIC_NAME)) IN ({placeholders})"

    sql = f"""
        SELECT
            c.func_loc_id,
            c.floor_id,
            c.x_pos,
            c.y_pos,
            r.inspection_lot_id AS lot_id,
            r.valuation,
            r.mic_name,
            r.quantitative_result,
            TO_DATE(lot.CREATED_DATE) AS lot_date
        FROM {COORD_TBL} c
        JOIN {POINT_TBL} p ON c.func_loc_id = p.FUNCTIONAL_LOCATION
        LEFT JOIN {LOT_TBL} lot ON p.INSPECTION_LOT_ID = lot.INSPECTION_LOT_ID
            AND lot.PLANT_ID = :plant_id
            AND lot.INSPECTION_TYPE IN {INSP_TYPES_SQL}
        LEFT JOIN {RESULT_TBL} r ON p.INSPECTION_LOT_ID = r.INSPECTION_LOT_ID
            AND p.OPERATION_ID = r.OPERATION_ID
            AND p.SAMPLE_ID = r.SAMPLE_ID
        WHERE c.plant_id = :plant_id
          AND c.floor_id = :floor_id
          AND (lot.CREATED_DATE IS NULL OR (lot.CREATED_DATE >= :date_from AND lot.CREATED_DATE <= :date_to))
          {mic_filter}
        ORDER BY c.func_loc_id, lot.CREATED_DATE ASC
    """

    rows = await run_sql_async(token, sql, params)
    
    # Group by location
    by_loc = defaultdict(list)
    coords = {}
    for r in rows:
        lid = str(r["func_loc_id"])
        by_loc[lid].append(r)
        coords[lid] = {
            "floor_id": str(r["floor_id"]),
            "x": float(r["x_pos"]),
            "y": float(r["y_pos"])
        }

    markers = []
    for lid, loc_rows in by_loc.items():
        # Risk score calculation
        risk = _risk_score(loc_rows, reference_date, applied_lambda)
        
        # Latest valuation for deterministic status
        latest = loc_rows[-1] if loc_rows else {}
        l_val = (latest.get("valuation") or "").upper()
        
        # Aggregate counts for MarkerData
        fails = sum(1 for r in loc_rows if (r.get("valuation") or "").upper() in ("R", "REJ", "REJECT"))
        passes = sum(1 for r in loc_rows if (r.get("valuation") or "").upper() in ("A", "ACC", "ACCEPT"))
        
        # Status logic
        if decay_lambda is None:
            # Deterministic mode: only latest result + early warning
            status = "FAIL" if l_val in ("R", "REJ", "REJECT") else "PASS"
        else:
            # Continuous mode: risk score thresholds + latest override
            status = "PASS"
            if risk > 1.0: status = "WARNING"
            if risk > 5.0: status = "FAIL"
            if l_val in ("R", "REJ", "REJECT"): status = "FAIL"
        
        # Early warning check applies to all modes
        warning = _detect_early_warning(loc_rows)
        if warning and status == "PASS":
            status = "WARNING"

        c = coords[lid]
        markers.append(MarkerData(
            func_loc_id=lid,
            floor_id=c["floor_id"],
            x_pos=c["x"],
            y_pos=c["y"],
            status=status,
            fail_count=fails,
            pass_count=passes,
            total_count=len(loc_rows),
            risk_score=round(risk, 2)
        ))

    return HeatmapResponse(
        floor_id=floor_id,
        mode="continuous" if decay_lambda is not None else "deterministic",
        time_window_days=time_window_days,
        decay_lambda=applied_lambda,
        markers=markers
    )
