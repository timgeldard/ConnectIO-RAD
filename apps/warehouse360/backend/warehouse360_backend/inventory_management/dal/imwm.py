"""DAL — IMWM (IM vs WM) stock comparison, movements, exceptions, and aging.

Backed by the views under ``connected_plant_uat.wh360.imwm_*_v`` (DDL in
``apps/warehouse360/sql/views/``). All queries are plant-scopable.
"""

from typing import Optional

from warehouse360_backend.utils.db import run_sql_async, sql_param, tbl
from warehouse360_backend.inventory_management.domain.plant_scope import PlantScope


def _plant_scope_filter(plant_id: Optional[str]) -> tuple[str, list[dict]]:
    """Build the WHERE clause and params for a single-plant scope, or empty."""
    scope = PlantScope.from_optional(plant_id)
    if not scope.is_single_plant:
        return "", []
    return "WHERE plant_id = :plant_id", [sql_param("plant_id", scope.plant_id)]


async def fetch_imwm_stock(token: str, plant_id: Optional[str] = None) -> list[dict]:
    """Return IM vs WM stock comparison rows."""
    plant_filter, params = _plant_scope_filter(plant_id)
    q = f"""
        SELECT *
        FROM {tbl('imwm_stock_comparison_v')}
        {plant_filter}
        ORDER BY plant_id, material_id, storage_loc
    """
    return await run_sql_async(token, q, params, endpoint_hint="wh360.imwm_stock")


async def fetch_imwm_movements(token: str, plant_id: Optional[str] = None) -> list[dict]:
    """Return recent goods movements (last 200 rows) for the activity strip."""
    plant_filter, params = _plant_scope_filter(plant_id)
    q = f"""
        SELECT *
        FROM {tbl('imwm_movements_v')}
        {plant_filter}
        ORDER BY posting_date DESC, posting_time DESC
        LIMIT 200
    """
    return await run_sql_async(token, q, params, endpoint_hint="wh360.imwm_movements")


async def fetch_imwm_exceptions(token: str, plant_id: Optional[str] = None) -> list[dict]:
    """Return the rule-generated IMWM exception queue."""
    plant_filter, params = _plant_scope_filter(plant_id)
    q = f"""
        SELECT *
        FROM {tbl('imwm_exceptions_v')}
        {plant_filter}
        ORDER BY severity DESC, exception_type
    """
    return await run_sql_async(token, q, params, endpoint_hint="wh360.imwm_exceptions")


async def fetch_imwm_aging(token: str, plant_id: Optional[str] = None) -> list[dict]:
    """Return inventory aging buckets for the analytics chart."""
    plant_filter, params = _plant_scope_filter(plant_id)
    q = f"""
        SELECT *
        FROM {tbl('imwm_analytics_aging_v')}
        {plant_filter}
        ORDER BY plant_id, age_bucket_order
    """
    return await run_sql_async(token, q, params, endpoint_hint="wh360.imwm_aging")
