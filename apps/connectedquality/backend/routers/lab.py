"""Lab Board stub router — returns mock inspection lot failures.

Replace mock returns with DAL queries once the CQ data layer is wired.
"""

from fastapi import APIRouter

router = APIRouter()


@router.get("/lab/fails")
async def lab_fails(plant_id: str = "P806", lot_type: str = "04"):
    """Inspection lot characteristics that have failed or are out-of-warning."""
    return {
        "plant_id": plant_id,
        "lot_type": lot_type,
        "fails": [],
    }
