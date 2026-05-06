"""EnvMon module routers — returns real data from envmon_backend DALs."""

from fastapi import APIRouter, Depends
from fastapi import Query

from shared_auth.identity import require_proxy_user, UserIdentity
from connectedquality_backend.application.envmon import (
    fetch_active_plant_ids,
    fetch_floor_location_counts,
    fetch_floors,
    fetch_plant_kpis,
    fetch_plant_metadata,
)

router = APIRouter()


@router.get("/envmon/plants")
async def envmon_plants(user: UserIdentity = Depends(require_proxy_user)):
    """Global plant list with compliance status."""
    token = user.raw_token
    active_plant_ids = await fetch_active_plant_ids(token)
    if not active_plant_ids:
        return {"plants": []}
        
    metadata = await fetch_plant_metadata(token, active_plant_ids)
    meta_map = {row["PLANT_ID"]: row for row in metadata}
    
    plants = []
    for plant_id in active_plant_ids:
        kpis = await fetch_plant_kpis(token, plant_id, days=90)
        kpi = kpis[0] if kpis else {"active_fails": 0, "warnings": 0}
        
        status = "good"
        if kpi["active_fails"] > 0:
            status = "bad"
        elif kpi["warnings"] > 0:
            status = "warn"
            
        plants.append({
            "id": plant_id,
            "name": meta_map.get(plant_id, {}).get("PLANT_NAME", plant_id),
            "status": status,
            "warnings": kpi["warnings"],
        })
        
    return {"plants": plants}


@router.get("/envmon/floor")
async def envmon_floor(
    plant_id: str = Query(..., description="Plant selected by the user/session/deep link."),
    floor: str | None = Query(default=None, description="Optional floor selected by the user."),
    user: UserIdentity = Depends(require_proxy_user),
):
    """Per-floor location markers with risk status."""
    # To keep this fast for CQ Overview, we will just return floor list and mapped location counts
    # rather than full marker details. The real app handles the map rendering.
    token = user.raw_token
    floors = await fetch_floors(token, plant_id)
    counts = await fetch_floor_location_counts(token, plant_id)
    count_map = {row["floor_id"]: row["location_count"] for row in counts}
    
    return {
        "plant_id": plant_id,
        "floor": floor,
        "locations": [
            {
                "floor_id": f["floor_id"], 
                "floor_name": f["floor_name"],
                "mapped_locations": count_map.get(f["floor_id"], 0)
            } for f in floors
        ],
    }


@router.get("/envmon/history")
async def envmon_history(
    plant_id: str = Query(..., description="Plant selected by the user/session/deep link."),
    floor: str | None = Query(default=None, description="Optional floor selected by the user."),
    days: int = 90,
):
    """Time-series swab history for time-lapse playback."""
    # Not immediately wired as it's complex and not strictly needed for Home overview, 
    # but we leave the stub signature for future expansion.
    return {
        "plant_id": plant_id,
        "floor": floor,
        "days": days,
        "frames": [],
        "data_available": False,
        "reason": "envmon_time_lapse_api_pending",
    }
