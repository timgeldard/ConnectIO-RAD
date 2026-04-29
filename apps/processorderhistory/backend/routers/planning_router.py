"""Planning board router — POST /api/planning/schedule."""
from typing import Optional

from fastapi import APIRouter, Header
from pydantic import BaseModel

from backend.dal.planning_dal import fetch_planning_schedule
from backend.db import check_warehouse_config, resolve_token

router = APIRouter()


class PlanningScheduleRequest(BaseModel):
    """Request body for the planning schedule endpoint."""

    plant_id: Optional[str] = None


@router.post("/planning/schedule")
async def get_planning_schedule(
    body: PlanningScheduleRequest,
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """Return production planning schedule: Gantt blocks, backlog, and KPIs.

    Blocks are silver process orders with SCHEDULED_START within the ±7-day
    window, enriched with gold order status and material name.  Backlog contains
    up to 30 released/unstarted orders from the gold view.  KPIs are derived
    from block and backlog data; capacity-based metrics return zero until a
    capacity master or schedule adherence metric view is available.
    """
    token = resolve_token(x_forwarded_access_token, authorization)
    check_warehouse_config()
    return await fetch_planning_schedule(token, plant_id=body.plant_id)
