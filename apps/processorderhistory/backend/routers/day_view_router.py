"""Day View router — POST /api/dayview."""
from typing import Optional

from fastapi import APIRouter, Header
from pydantic import BaseModel

from backend.dal.day_view_dal import fetch_day_view
from backend.db import check_warehouse_config, resolve_token

router = APIRouter()


class DayViewRequest(BaseModel):
    """Request body for the day view endpoint."""

    day: Optional[str] = None
    plant_id: Optional[str] = None


@router.post("/dayview")
async def get_day_view(
    body: DayViewRequest,
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """Return Day View data: Gantt blocks and downtime for a single production day.

    Blocks are derived from ADP movement first/last timestamps on ``day``, so only
    orders with actual goods-issue activity are included.  Planned orders with no
    movements are excluded automatically.  ``day`` is an ISO date string
    (YYYY-MM-DD); omitting it defaults to today UTC.
    """
    token = resolve_token(x_forwarded_access_token, authorization)
    check_warehouse_config()
    return await fetch_day_view(token, day=body.day, plant_id=body.plant_id)
