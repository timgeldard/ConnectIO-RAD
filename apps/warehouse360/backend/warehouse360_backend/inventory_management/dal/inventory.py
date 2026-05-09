"""DAL — warehouse bin stock (LAGP/LQUA) and line-side replenishment stock."""

from warehouse360_backend.utils.db import run_sql_async, sql_param, tbl
from warehouse360_backend.inventory_management.domain.plant_scope import PlantScope


def _plant_scope_filter(plant_id: str | None) -> tuple[str, list[dict]]:
    scope = PlantScope.from_optional(plant_id)
    if not scope.is_single_plant:
        return "", []
    return "WHERE plant_id = :plant_id", [sql_param("plant_id", scope.plant_id)]


async def fetch_bin_stock(
    token: str,
    plant_id: str | None = None,
    lgtyp: str | None = None,
) -> list[dict]:
    """Return current stock by warehouse bin, ordered by storage type then bin.

    Args:
        token: Databricks access token forwarded from the proxy.
        plant_id: Optional plant filter; ``None`` returns all visible plants.
        lgtyp: Optional storage-type filter for drill-down; ``None`` returns
            all types (still capped at 2000 rows).
    """
    plant_filter, params = _plant_scope_filter(plant_id)
    if lgtyp is not None:
        params.append(sql_param("lgtyp", lgtyp))
        type_clause = (" AND" if plant_filter else " WHERE") + " lgtyp = :lgtyp"
    else:
        type_clause = ""
    q = f"""
        SELECT *
        FROM {tbl('wh360_bin_stock_v')}
        {plant_filter}{type_clause}
        ORDER BY lgtyp, bin_id
        LIMIT 2000
    """
    return await run_sql_async(token, q, params, endpoint_hint="wh360.bin_stock")


async def fetch_bin_stock_summary(token: str, plant_id: str | None = None) -> list[dict]:
    """Return per-storage-type aggregate bin counts for the overview utilisation card.

    Returns one row per ``lgtyp`` with occupied/free/blocked tallies.  No row
    limit is needed because the result set is bounded by the number of distinct
    storage types (typically < 100).

    Args:
        token: Databricks access token forwarded from the proxy.
        plant_id: Optional plant filter; ``None`` aggregates across all plants.
    """
    plant_filter, params = _plant_scope_filter(plant_id)
    q = f"""
        SELECT
            lgtyp,
            COUNT(*)                                                         AS total_bins,
            COUNT(*) FILTER (WHERE bin_status = 'occupied')                 AS occupied_bins,
            COUNT(*) FILTER (WHERE bin_status = 'free')                     AS free_bins,
            COUNT(*) FILTER (WHERE bin_status IN ('blocked', 'restricted')) AS blocked_bins
        FROM {tbl('wh360_bin_stock_v')}
        {plant_filter}
        GROUP BY lgtyp
        ORDER BY lgtyp
    """
    return await run_sql_async(token, q, params, endpoint_hint="wh360.bin_stock_summary")


async def fetch_lineside(token: str, plant_id: str | None = None) -> list[dict]:
    """Return current line-side stock positions ordered by material."""
    plant_filter, params = _plant_scope_filter(plant_id)
    q = f"""
        SELECT *
        FROM {tbl('wh360_lineside_stock_v')}
        {plant_filter}
        ORDER BY material_id
        LIMIT 500
    """
    return await run_sql_async(token, q, params, endpoint_hint="wh360.lineside")


async def fetch_near_expiry_batches(
    token: str,
    plant_id: str | None = None,
) -> list[dict]:
    """Return batch-level near-expiry stock (within 90 days) ordered by expiry.

    Args:
        token: Databricks access token forwarded from the proxy.
        plant_id: Optional plant filter; ``None`` returns all visible plants.
    """
    plant_filter, params = _plant_scope_filter(plant_id)
    q = f"""
        SELECT *
        FROM {tbl('wh360_near_expiry_batches_v')}
        {plant_filter}
        ORDER BY days_to_expiry
        LIMIT 500
    """
    return await run_sql_async(token, q, params, endpoint_hint="wh360.near_expiry_batches")
