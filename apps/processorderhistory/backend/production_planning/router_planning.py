"""Planning board router — POST /api/planning/schedule."""
from typing import Optional

from shared_auth import UserIdentity, require_proxy_user
from fastapi import Depends, APIRouter, Header
from pydantic import BaseModel

from backend.production_planning.application import queries as planning_queries
from backend.db import check_warehouse_config

router = APIRouter()


class PlanningScheduleRequest(BaseModel):
    """Request body for the planning schedule endpoint."""

    plant_id: Optional[str] = None


@router.post("/planning/schedule")
async def get_planning_schedule(body: PlanningScheduleRequest,
    user: UserIdentity = Depends(require_proxy_user)
):
    """Return production planning schedule: Gantt blocks, backlog, and KPIs.

    Blocks are silver process orders with SCHEDULED_START within the ±7-day
    window, enriched with gold order status and material name.  Backlog contains
    up to 30 released/unstarted orders from the gold view.  KPIs are derived
    from block and backlog data; capacity-based metrics return zero until a
    capacity master or schedule adherence metric view is available.
    """
    token = user.raw_token
    check_warehouse_config()
    return await planning_queries.get_planning_schedule(token, plant_id=body.plant_id)
