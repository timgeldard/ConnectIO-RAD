"""Application query handlers for manufacturing analytics."""

from __future__ import annotations

from typing import Optional

from backend.manufacturing_analytics.dal import adherence_analytics_dal
from backend.manufacturing_analytics.dal import downtime_analytics_dal
from backend.manufacturing_analytics.dal import equipment_insights2_dal
from backend.manufacturing_analytics.dal import equipment_insights_dal
from backend.manufacturing_analytics.dal import oee_analytics_dal
from backend.manufacturing_analytics.dal import quality_analytics_dal
from backend.manufacturing_analytics.dal import yield_analytics_dal


async def get_adherence_analytics(
    token: str,
    *,
    plant_id: Optional[str],
    date_from: Optional[str],
    date_to: Optional[str],
    request_path: str,
) -> dict:
    return await adherence_analytics_dal.fetch_adherence_analytics(
        token,
        plant_id=plant_id,
        date_from=date_from,
        date_to=date_to,
        request_path=request_path,
    )


async def get_downtime_analytics(
    token: str,
    *,
    plant_id: Optional[str],
    date_from: Optional[str],
    date_to: Optional[str],
    request_path: str,
) -> dict:
    return await downtime_analytics_dal.fetch_downtime_analytics(
        token,
        plant_id=plant_id,
        date_from=date_from,
        date_to=date_to,
        request_path=request_path,
    )


async def get_equipment_insights(token: str, *, plant_id: Optional[str], timezone: str) -> dict:
    return await equipment_insights_dal.fetch_equipment_insights(token, plant_id=plant_id, timezone=timezone)


async def get_equipment_insights2(token: str, *, plant_id: Optional[str], timezone: str) -> dict:
    return await equipment_insights2_dal.fetch_equipment_insights2(token, plant_id=plant_id, timezone=timezone)


async def get_oee_analytics(
    token: str,
    *,
    plant_id: Optional[str],
    date_from: Optional[str],
    date_to: Optional[str],
    timezone: str,
) -> dict:
    return await oee_analytics_dal.fetch_oee_analytics(
        token,
        plant_id=plant_id,
        date_from=date_from,
        date_to=date_to,
        timezone=timezone,
    )


async def get_quality_analytics(
    token: str,
    *,
    plant_id: Optional[str],
    date_from: Optional[str],
    date_to: Optional[str],
    timezone: str,
) -> dict:
    return await quality_analytics_dal.fetch_quality_analytics(
        token,
        plant_id=plant_id,
        date_from=date_from,
        date_to=date_to,
        timezone=timezone,
    )


async def get_yield_analytics(
    token: str,
    *,
    plant_id: Optional[str],
    date_from: Optional[str],
    date_to: Optional[str],
) -> dict:
    return await yield_analytics_dal.fetch_yield_analytics(
        token,
        plant_id=plant_id,
        date_from=date_from,
        date_to=date_to,
    )
