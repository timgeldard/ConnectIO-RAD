"""Application query handlers for Warehouse360 inventory management."""

from __future__ import annotations

from typing import Optional

from warehouse360_backend.inventory_management.dal import inbound as inbound_dal
from warehouse360_backend.inventory_management.dal import inventory as inventory_dal
from warehouse360_backend.inventory_management.dal import plants as plants_dal
from warehouse360_backend.inventory_management.domain.plant_scope import PlantScope


async def list_bin_stock(token: str, plant_id: Optional[str] = None) -> list[dict]:
    """Return warehouse bin stock for the selected plant scope."""

    scope = PlantScope.from_optional(plant_id)
    return await inventory_dal.fetch_bin_stock(token, plant_id=scope.plant_id)


async def list_lineside_stock(token: str, plant_id: Optional[str] = None) -> list[dict]:
    """Return line-side inventory for the selected plant scope."""

    scope = PlantScope.from_optional(plant_id)
    return await inventory_dal.fetch_lineside(token, plant_id=scope.plant_id)


async def list_inbound_receipts(token: str, plant_id: Optional[str] = None) -> list[dict]:
    """Return inbound receipts for the selected plant scope."""

    scope = PlantScope.from_optional(plant_id)
    return await inbound_dal.fetch_inbound(token, plant_id=scope.plant_id)


async def get_receipt_detail(token: str, po_id: str) -> dict:
    """Return inbound receipt detail for one purchase or STO order."""

    return await inbound_dal.fetch_receipt_detail(token, po_id)


async def list_plants(token: str) -> list[dict]:
    """Return Warehouse360 plants visible to the caller."""

    return await plants_dal.fetch_plants(token)
