"""Day View router — POST /api/dayview."""
from typing import Optional

from shared_auth import UserIdentity, require_proxy_user
from fastapi import Depends, APIRouter, Header
from pydantic import BaseModel

from backend.dal.day_view_dal import fetch_day_view
from backend.db import check_warehouse_config

router = APIRouter()


class DayViewRequest(BaseModel):
    """Request body for the day view endpoint."""

    day: Optional[str] = None
    plant_id: Optional[str] = None


@router.post("/dayview")
async def get_day_view(body: DayViewRequest,
    user: UserIdentity = Depends(require_proxy_user)
):
    """Return Day View data: Gantt blocks and downtime for a single production day.

    Blocks are derived from ADP movement first/last timestamps on ``day``, so only
    orders with actual goods-issue activity are included.  Planned orders with no
    movements are excluded automatically.  ``day`` is an ISO date string
    (YYYY-MM-DD); omitting it defaults to today UTC.
    """
    token = user.raw_token
    check_warehouse_config()
    return await fetch_day_view(token, day=body.day, plant_id=body.plant_id)
