"""DAL — IMWM (IM vs WM) stock comparison, movements, exceptions, and aging.

Backed by the views under ``connected_plant_uat.wh360.imwm_*_v`` (DDL in
``apps/warehouse360/sql/views/``). All queries are plant-scopable.
"""

from typing import Optional

from warehouse360_backend.utils.db import run_sql_async, sql_param, tbl
from warehouse360_backend.inventory_management.domain.plant_scope import PlantScope


def _plant_scope_filter(plant_id: Optional[str]) -> tuple[str, list[dict]]:
    """Build the WHERE clause and params for a single-plant scope.

    Args:
        plant_id: Optional plant identifier from the caller.

    Returns:
        Two-tuple of ``(where_clause, params)``. ``where_clause`` is the
        string fragment to inline into a SELECT (empty when no scope
        restriction is needed); ``params`` is the matching parameter list
        for the Databricks SQL Statement API.
    """
    scope = PlantScope.from_optional(plant_id)
    if not scope.is_single_plant:
        return "", []
    return "WHERE plant_id = :plant_id", [sql_param("plant_id", scope.plant_id)]


async def fetch_imwm_stock(token: str, plant_id: Optional[str] = None) -> list[dict]:
    """Return IM vs WM stock comparison rows.

    Capped at 2000 rows to stay under the Databricks SQL Statement API's
    25 MB inline-result ceiling. Callers should pass ``plant_id`` to scope
    further; un-scoped requests across all plants can exceed the cap.

    Args:
        token: Forwarded Databricks access token (``x-forwarded-access-token``).
        plant_id: Optional plant ID. ``None`` means all plants visible to
            the caller's token.

    Returns:
        List of rows from ``imwm_stock_comparison_v``, ordered by plant,
        material, and storage location.
    """
    plant_filter, params = _plant_scope_filter(plant_id)
    q = f"""
        SELECT *
        FROM {tbl('imwm_stock_comparison_v')}
        {plant_filter}
        ORDER BY plant_id, material_id, storage_loc
        LIMIT 2000
    """
    return await run_sql_async(token, q, params, endpoint_hint="wh360.imwm_stock")


async def fetch_imwm_movements(token: str, plant_id: Optional[str] = None) -> list[dict]:
    """Return recent goods movements for the activity strip.

    Capped at 200 rows because the activity strip shows a short rolling
    feed; ordering DESC by posting_date/posting_time means the newest
    movements always come first.

    Args:
        token: Forwarded Databricks access token.
        plant_id: Optional plant ID; ``None`` returns all visible plants.

    Returns:
        List of the most-recent rows from ``imwm_movements_v``.
    """
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
    """Return the rule-generated IMWM exception queue.

    Capped at 2000 rows for the same reason as :func:`fetch_imwm_stock`.
    Ordering puts highest-severity rows first so the UI can render the
    queue without re-sorting client-side.

    Args:
        token: Forwarded Databricks access token.
        plant_id: Optional plant ID; ``None`` returns all visible plants.

    Returns:
        List of rows from ``imwm_exceptions_v`` ordered by severity DESC.
    """
    plant_filter, params = _plant_scope_filter(plant_id)
    q = f"""
        SELECT *
        FROM {tbl('imwm_exceptions_v')}
        {plant_filter}
        ORDER BY severity DESC, exception_type
        LIMIT 2000
    """
    return await run_sql_async(token, q, params, endpoint_hint="wh360.imwm_exceptions")


async def fetch_imwm_aging(token: str, plant_id: Optional[str] = None) -> list[dict]:
    """Return inventory aging buckets for the analytics chart.

    Capped at 2000 rows for the same reason as :func:`fetch_imwm_stock`.
    Aging is pre-bucketed (a handful of rows per plant), so this cap is
    defensive rather than load-bearing.

    Args:
        token: Forwarded Databricks access token.
        plant_id: Optional plant ID; ``None`` returns all visible plants.

    Returns:
        List of aggregate rows (one per plant × age bucket) from
        ``imwm_analytics_aging_v``.
    """
    plant_filter, params = _plant_scope_filter(plant_id)
    q = f"""
        SELECT *
        FROM {tbl('imwm_analytics_aging_v')}
        {plant_filter}
        ORDER BY plant_id, age_bucket_order
        LIMIT 2000
    """
    return await run_sql_async(token, q, params, endpoint_hint="wh360.imwm_aging")
