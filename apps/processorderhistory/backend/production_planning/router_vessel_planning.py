"""Vessel planning analytics router — POST /api/vessel-planning/analytics."""
from typing import Optional

from shared_auth import UserIdentity, require_proxy_user
from fastapi import Depends, APIRouter, Header
from pydantic import BaseModel

from backend.production_planning.dal.vessel_planning_dal import fetch_vessel_planning_analytics
from backend.db import check_warehouse_config, validate_timezone

router = APIRouter()


class VesselPlanningRequest(BaseModel):
    """Request body for the vessel planning analytics endpoint."""

    plant_id: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    timezone: Optional[str] = None


@router.post("/vessel-planning/analytics")
async def get_vessel_planning_analytics(body: VesselPlanningRequest,
    user: UserIdentity = Depends(require_proxy_user)
):
    """Return vessel planning analytics: live vessel states, priority queue, and activity trend.

    Vessel states are derived from the most recent equipment event per vessel (90-day
    ROW_NUMBER window).  Material-vessel affinity is inferred from event co-occurrence
    counts in the requested date range.  Released order feasibility and recommendations
    are computed in Python — no Databricks views are added.

    ``date_from`` / ``date_to`` control the history table and affinity window (YYYY-MM-DD).
    Omitting both defaults to the last 30 days.  Vessel state always reflects the latest
    event within the 90-day lookback, independent of the date filter.
    """
    token = user.raw_token
    check_warehouse_config()
    return await fetch_vessel_planning_analytics(
        token,
        plant_id=body.plant_id,
        date_from=body.date_from,
        date_to=body.date_to,
        timezone=validate_timezone(body.timezone),
    )
