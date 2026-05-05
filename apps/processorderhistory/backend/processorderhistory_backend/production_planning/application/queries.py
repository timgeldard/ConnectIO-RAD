"""Application query handlers for production planning."""

from __future__ import annotations

from typing import Optional

from processorderhistory_backend.production_planning.dal import planning_dal
from processorderhistory_backend.production_planning.dal import vessel_planning_dal


async def get_planning_schedule(token: str, *, plant_id: Optional[str]) -> dict:
    """Return production planning schedule data."""

    return await planning_dal.fetch_planning_schedule(token, plant_id=plant_id)


async def get_vessel_planning_analytics(
    token: str,
    *,
    plant_id: Optional[str],
    date_from: Optional[str],
    date_to: Optional[str],
    timezone: str,
) -> dict:
    """Return vessel planning analytics."""

    return await vessel_planning_dal.fetch_vessel_planning_analytics(
        token,
        plant_id=plant_id,
        date_from=date_from,
        date_to=date_to,
        timezone=timezone,
    )
