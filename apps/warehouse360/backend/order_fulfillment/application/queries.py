"""Application query handlers for Warehouse360 order fulfillment."""

from __future__ import annotations

from typing import Optional

from backend.inventory_management.domain.plant_scope import PlantScope
from backend.order_fulfillment.dal import deliveries as deliveries_dal
from backend.order_fulfillment.dal import process_orders as process_orders_dal
from backend.order_fulfillment.domain.delivery_status import (
    is_active_delivery,
    normalize_delivery_status,
)
from backend.order_fulfillment.domain.order_status import (
    is_open_order,
    normalize_po_status,
)


async def list_deliveries(token: str, plant_id: Optional[str] = None) -> list[dict]:
    """Return outbound deliveries for the selected plant scope.

    Each row is enriched with ``delivery_status_normalized`` (canonical
    DeliveryStatus) and ``is_active`` (bool) derived from the raw
    ``delivery_status`` field in ``wh360_deliveries_v``.
    """
    scope = PlantScope.from_optional(plant_id)
    rows = await deliveries_dal.fetch_deliveries(token, plant_id=scope.plant_id)
    for row in rows:
        status = normalize_delivery_status(row.get("delivery_status"))
        row["delivery_status_normalized"] = status
        row["is_active"] = is_active_delivery(status)
    return rows


async def get_delivery_detail(token: str, delivery_id: str) -> dict:
    """Return one outbound delivery detail payload."""
    return await deliveries_dal.fetch_delivery_detail(token, delivery_id)


async def list_process_orders(token: str, plant_id: Optional[str] = None) -> list[dict]:
    """Return process orders for the selected plant scope.

    Each row is enriched with ``po_status_normalized`` (canonical
    ProcessOrderStatus) and ``is_open`` (bool) derived from the raw
    ``order_status`` field in ``wh360_process_orders_v``.
    """
    scope = PlantScope.from_optional(plant_id)
    rows = await process_orders_dal.fetch_process_orders(token, plant_id=scope.plant_id)
    for row in rows:
        status = normalize_po_status(row.get("order_status"))
        row["po_status_normalized"] = status
        row["is_open"] = is_open_order(status)
    return rows


async def get_process_order_detail(token: str, order_id: str) -> dict:
    """Return one process order detail payload."""
    return await process_orders_dal.fetch_order_detail(token, order_id)
