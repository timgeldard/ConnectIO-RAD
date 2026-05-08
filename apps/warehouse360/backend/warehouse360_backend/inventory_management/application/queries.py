"""Application query handlers for Warehouse360 inventory management."""

from __future__ import annotations

from typing import Optional

from shared_db import assert_plant_authorized

from warehouse360_backend.inventory_management.dal import imwm as imwm_dal
from warehouse360_backend.inventory_management.dal import inbound as inbound_dal
from warehouse360_backend.inventory_management.dal import inventory as inventory_dal
from warehouse360_backend.inventory_management.dal import plants as plants_dal
from warehouse360_backend.inventory_management.domain.plant_scope import PlantScope


async def list_bin_stock(token: str, plant_id: Optional[str] = None) -> list[dict]:
    """Return warehouse bin stock for the selected plant scope."""

    scope = PlantScope.from_optional(plant_id)
    await assert_plant_authorized(token, scope.plant_id)
    return await inventory_dal.fetch_bin_stock(token, plant_id=scope.plant_id)


async def list_lineside_stock(token: str, plant_id: Optional[str] = None) -> list[dict]:
    """Return line-side inventory for the selected plant scope."""

    scope = PlantScope.from_optional(plant_id)
    await assert_plant_authorized(token, scope.plant_id)
    return await inventory_dal.fetch_lineside(token, plant_id=scope.plant_id)


async def list_inbound_receipts(token: str, plant_id: Optional[str] = None) -> list[dict]:
    """Return inbound receipts for the selected plant scope."""

    scope = PlantScope.from_optional(plant_id)
    await assert_plant_authorized(token, scope.plant_id)
    return await inbound_dal.fetch_inbound(token, plant_id=scope.plant_id)


async def get_receipt_detail(token: str, po_id: str) -> dict:
    """Return inbound receipt detail for one purchase or STO order."""

    return await inbound_dal.fetch_receipt_detail(token, po_id)


async def list_plants(token: str) -> list[dict]:
    """Return Warehouse360 plants visible to the caller."""

    return await plants_dal.fetch_plants(token)


async def list_imwm_stock(token: str, plant_id: Optional[str] = None) -> list[dict]:
    """Return IM vs WM stock comparison for the selected plant scope.

    Plant ID is normalised through :class:`PlantScope` so the same
    canonical-form / allowed-plant guard the rest of the application layer
    enforces is applied here too.

    Args:
        token: Forwarded Databricks access token.
        plant_id: Optional plant ID; ``None`` means all plants visible to
            the caller.

    Returns:
        List of rows from ``imwm_stock_comparison_v``.
    """
    scope = PlantScope.from_optional(plant_id)
    await assert_plant_authorized(token, scope.plant_id)
    return await imwm_dal.fetch_imwm_stock(token, plant_id=scope.plant_id)


async def list_imwm_movements(token: str, plant_id: Optional[str] = None) -> list[dict]:
    """Return recent IMWM goods movements for the activity strip.

    Args:
        token: Forwarded Databricks access token.
        plant_id: Optional plant ID; normalised via :class:`PlantScope`.

    Returns:
        List of rows from ``imwm_movements_v`` (capped at 200 in the DAL).
    """
    scope = PlantScope.from_optional(plant_id)
    await assert_plant_authorized(token, scope.plant_id)
    return await imwm_dal.fetch_imwm_movements(token, plant_id=scope.plant_id)


async def list_imwm_exceptions(token: str, plant_id: Optional[str] = None) -> list[dict]:
    """Return the IMWM rule-generated exception queue.

    Args:
        token: Forwarded Databricks access token.
        plant_id: Optional plant ID; normalised via :class:`PlantScope`.

    Returns:
        List of rows from ``imwm_exceptions_v``.
    """
    scope = PlantScope.from_optional(plant_id)
    await assert_plant_authorized(token, scope.plant_id)
    return await imwm_dal.fetch_imwm_exceptions(token, plant_id=scope.plant_id)


async def list_imwm_aging(token: str, plant_id: Optional[str] = None) -> list[dict]:
    """Return IMWM inventory aging buckets for the analytics chart.

    Args:
        token: Forwarded Databricks access token.
        plant_id: Optional plant ID; normalised via :class:`PlantScope`.

    Returns:
        List of aggregated rows (one per plant × age bucket) from
        ``imwm_analytics_aging_v``.
    """
    scope = PlantScope.from_optional(plant_id)
    await assert_plant_authorized(token, scope.plant_id)
    return await imwm_dal.fetch_imwm_aging(token, plant_id=scope.plant_id)
