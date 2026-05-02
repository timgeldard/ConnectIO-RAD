"""EnvMon module stub routers — returns mock data matching the handoff shape.

Replace mock returns with DAL queries once the CQ data layer is wired.
"""

from fastapi import APIRouter

router = APIRouter()


@router.get("/envmon/plants")
async def envmon_plants():
    """Global plant list with compliance status."""
    return {
        "plants": [
            {"id": "CHV", "name": "Charleville", "status": "good", "warnings": 0},
            {"id": "LIS", "name": "Listowel", "status": "warn", "warnings": 4},
            {"id": "CRG", "name": "Carrigaline", "status": "bad", "warnings": 6},
        ]
    }


@router.get("/envmon/floor")
async def envmon_floor(plant_id: str = "CHV", floor: str = "F2"):
    """Per-floor location markers with risk status."""
    return {
        "plant_id": plant_id,
        "floor": floor,
        "locations": [],
    }


@router.get("/envmon/history")
async def envmon_history(plant_id: str = "CHV", floor: str = "F2", days: int = 90):
    """Time-series swab history for time-lapse playback."""
    return {
        "plant_id": plant_id,
        "floor": floor,
        "days": days,
        "frames": [],
    }
