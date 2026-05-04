"""Application query handlers for Warehouse360 order fulfillment."""

from __future__ import annotations

from typing import Optional

from backend.inventory_management.domain.plant_scope import PlantScope
from backend.order_fulfillment.dal import deliveries as deliveries_dal
from backend.order_fulfillment.dal import process_orders as process_orders_dal


async def list_deliveries(token: str, plant_id: Optional[str] = None) -> list[dict]:
    """Return outbound deliveries for the selected plant scope."""

    scope = PlantScope.from_optional(plant_id)
    return await deliveries_dal.fetch_deliveries(token, plant_id=scope.plant_id)


async def get_delivery_detail(token: str, delivery_id: str) -> dict:
    """Return one outbound delivery detail payload."""

    return await deliveries_dal.fetch_delivery_detail(token, delivery_id)


async def list_process_orders(token: str, plant_id: Optional[str] = None) -> list[dict]:
    """Return process orders for the selected plant scope."""

    scope = PlantScope.from_optional(plant_id)
    return await process_orders_dal.fetch_process_orders(token, plant_id=scope.plant_id)


async def get_process_order_detail(token: str, order_id: str) -> dict:
    """Return one process order detail payload."""

    return await process_orders_dal.fetch_order_detail(token, order_id)
