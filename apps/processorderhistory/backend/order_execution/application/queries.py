"""Application query handlers for process order execution."""

from __future__ import annotations

from typing import Optional

from backend.order_execution.dal import day_view_dal
from backend.order_execution.dal import order_detail_dal
from backend.order_execution.dal import orders_dal
from backend.order_execution.dal import pours_analytics_dal


async def list_orders(token: str, *, plant_id: Optional[str], limit: int) -> list[dict]:
    """Return process order summaries for the list view."""

    return await orders_dal.fetch_orders_list(token, plant_id=plant_id, limit=limit)


async def get_order_detail(token: str, *, order_id: str) -> Optional[dict]:
    """Return process order execution and quality detail."""

    return await order_detail_dal.fetch_order_detail(token, order_id=order_id)


async def get_day_view(token: str, *, day: Optional[str], plant_id: Optional[str]) -> dict:
    """Return day-view schedule and downtime data."""

    return await day_view_dal.fetch_day_view(token, day=day, plant_id=plant_id)


async def get_pours_analytics(
    token: str,
    *,
    plant_id: Optional[str],
    date_from: Optional[str],
    date_to: Optional[str],
    timezone: str,
) -> dict:
    """Return process-order pour analytics."""

    return await pours_analytics_dal.fetch_pours_analytics(
        token,
        plant_id=plant_id,
        date_from=date_from,
        date_to=date_to,
        timezone=timezone,
    )
