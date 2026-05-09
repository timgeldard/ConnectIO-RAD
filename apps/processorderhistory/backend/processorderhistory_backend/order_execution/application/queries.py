"""Application query handlers for process order execution."""

from __future__ import annotations

from typing import Optional

from shared_db import assert_plant_authorized

from processorderhistory_backend.order_execution.dal import day_view_dal
from processorderhistory_backend.order_execution.dal import lineside_monitor_dal
from processorderhistory_backend.order_execution.dal import order_detail_dal
from processorderhistory_backend.order_execution.dal import orders_dal
from processorderhistory_backend.order_execution.dal import pours_analytics_dal


async def list_orders(token: str, *, plant_id: Optional[str], limit: int) -> list[dict]:
    """Return process order summaries for the list view."""
    await assert_plant_authorized(token, plant_id)
    return await orders_dal.fetch_orders_list(token, plant_id=plant_id, limit=limit)


async def get_order_detail(token: str, *, order_id: str) -> Optional[dict]:
    """Return process order execution and quality detail."""

    return await order_detail_dal.fetch_order_detail(token, order_id=order_id)


async def get_day_view(token: str, *, day: Optional[str], plant_id: Optional[str]) -> dict:
    """Return day-view schedule and downtime data."""
    await assert_plant_authorized(token, plant_id)
    return await day_view_dal.fetch_day_view(token, day=day, plant_id=plant_id)


async def get_lineside_monitor(token: str, *, plant_id: Optional[str]) -> dict:
    """Return live lineside monitor wallboard data.

    Args:
        token: Databricks access token forwarded from the request.
        plant_id: Optional plant filter selected by the user or platform shell.

    Returns:
        Lineside Monitor summary containing KPIs, line states, recent activity,
        line-side stock, and data availability metadata.
    """
    await assert_plant_authorized(token, plant_id)
    return await lineside_monitor_dal.fetch_lineside_monitor(token, plant_id=plant_id)


async def get_pours_analytics(
    token: str,
    *,
    plant_id: Optional[str],
    date_from: Optional[str],
    date_to: Optional[str],
    timezone: str,
) -> dict:
    """Return process-order pour analytics."""
    await assert_plant_authorized(token, plant_id)
    return await pours_analytics_dal.fetch_pours_analytics(
        token,
        plant_id=plant_id,
        date_from=date_from,
        date_to=date_to,
        timezone=timezone,
    )
