"""Alarms / cross-module signal inbox router.

Returns a combined feed of real signals from envmon and spc DALs.
"""
from typing import Optional

from fastapi import APIRouter, Depends

from shared_auth.identity import require_proxy_user, UserIdentity
from envmon_backend.inspection_analysis.dal.plants import fetch_active_plant_ids, fetch_plant_kpis
from spc_backend.process_control.dal.analysis import fetch_scorecard

router = APIRouter()


@router.get("/alarms")
async def get_alarms(status: Optional[str] = None, source: Optional[str] = None, user: UserIdentity = Depends(require_proxy_user)):
    """Cross-module alarm stream, optionally filtered by status or source module."""
    
    alarms = []
    open_count = 0
    token = user.raw_token

    # 1. Fetch SPC Scorecard OOC flags for a default material
    # In a real setup, we would query a global alerts view, but for now we aggregate
    try:
        spc_rows = await fetch_scorecard(token, material_id="20582002", plant_id=None, date_from=None, date_to=None)
        for row in spc_rows:
            if not row.get("is_stable", True):
                open_count += 1
                alarms.append({
                    "id": f"spc-{row.get('mic_id', 'unknown')}",
                    "source": "spc",
                    "title": f"OOC detected for {row.get('mic_name', 'Unknown')}",
                    "severity": "warn",
                    "status": "open",
                })
    except Exception:
        pass # Ignore SPC dal errors for demo robustness

    # 2. Fetch Envmon KPIs for active plants
    try:
        active_plant_ids = await fetch_active_plant_ids(token)
        for plant_id in active_plant_ids[:5]: # Limit to 5 for speed
            kpis = await fetch_plant_kpis(token, plant_id, days=90)
            if kpis and kpis[0]["active_fails"] > 0:
                open_count += 1
                alarms.append({
                    "id": f"envmon-{plant_id}",
                    "source": "envmon",
                    "title": f"Active fails in {plant_id}",
                    "severity": "bad",
                    "status": "open",
                })
    except Exception:
        pass

    # Filter if requested
    if source:
        alarms = [a for a in alarms if a["source"] == source]
    if status:
        alarms = [a for a in alarms if a["status"] == status]

    return {
        "total": len(alarms),
        "open": open_count,
        "acknowledged": 0,
        "alarms": alarms,
    }
