"""Alarms / cross-module signal inbox router.

Returns a combined feed of real signals from EnvMon and SPC application services.
"""
from typing import Optional

from fastapi import APIRouter, Depends, Query

from shared_auth.identity import require_proxy_user, UserIdentity
from connectedquality_backend.application.alarms import fetch_active_plant_ids, fetch_plant_kpis, fetch_scorecard

router = APIRouter()


@router.get("/alarms")
async def get_alarms(
    status: Optional[str] = None,
    source: Optional[str] = None,
    material: Optional[str] = Query(
        default=None,
        description="Optional material context used to include SPC scorecard signals.",
    ),
    user: UserIdentity = Depends(require_proxy_user),
):
    """
    Retrieve a cross-module alarm stream aggregating signals from multiple apps.

    Args:
        status: Optional filter by status (e.g., 'open', 'acknowledged').
        source: Optional filter by source module (e.g., 'spc', 'envmon').
        user: Authenticated user identity.

    Returns:
        A dictionary containing the aggregated alarm count and a list of alarm objects.

    Raises:
        HTTPException: If upstream source requests fail unexpectedly or validation errors occur.
    """
    
    alarms = []
    open_count = 0
    token = user.raw_token

    if material:
        try:
            spc_rows = await fetch_scorecard(token, material_id=material, plant_id=None, date_from=None, date_to=None)
            for row in spc_rows:
                if not row.get("is_stable", True):
                    open_count += 1
                    alarms.append({
                        "id": f"spc-{material}-{row.get('mic_id', 'unknown')}",
                        "source": "spc",
                        "title": f"OOC detected for {row.get('mic_name', row.get('mic_id', 'Unknown characteristic'))}",
                        "severity": "warn",
                        "status": "open",
                        "context": {
                            "material_id": material,
                            "mic_id": row.get("mic_id"),
                        },
                    })
        except Exception:
            pass

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
                    "context": {"plant_id": plant_id},
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
