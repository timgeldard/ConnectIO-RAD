"""Lab Board router."""

from fastapi import APIRouter, Query

router = APIRouter()


@router.get("/lab/fails")
async def lab_fails(
    plant_id: str = Query(..., description="Plant selected by the user/session/deep link."),
    lot_type: str | None = Query(default=None, description="Optional SAP inspection lot type."),
):
    """Inspection lot characteristics that have failed or are out-of-warning."""
    return {
        "plant_id": plant_id,
        "lot_type": lot_type,
        "fails": [],
        "data_available": False,
        "reason": "lab_failures_api_pending",
    }
