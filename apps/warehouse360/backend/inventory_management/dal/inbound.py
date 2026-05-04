"""DAL — inbound deliveries / purchase orders (EKKO/EKPO, LIKP GR side)."""

from backend.utils.db import run_sql_async, sql_param, tbl
from backend.inventory_management.domain.plant_scope import PlantScope


def _plant_scope_filter(plant_id: str | None) -> tuple[str, list[dict]]:
    scope = PlantScope.from_optional(plant_id)
    if not scope.is_single_plant:
        return "", []
    return "WHERE plant_id = :plant_id", [sql_param("plant_id", scope.plant_id)]


async def fetch_inbound(token: str, plant_id: str | None = None) -> list[dict]:
    """Return inbound receipts ordered by expected delivery date."""
    plant_filter, params = _plant_scope_filter(plant_id)
    q = f"""
        SELECT *
        FROM {tbl('wh360_inbound_v')}
        {plant_filter}
        ORDER BY delivery_date
        LIMIT 500
    """
    return await run_sql_async(token, q, params, endpoint_hint="wh360.inbound")


async def fetch_receipt_detail(token: str, po_id: str) -> dict:
    """Return one purchase/STO order with its available wh360_inbound_v lines."""
    params = [sql_param("po_id", po_id)]

    items_q = f"""
        SELECT *
        FROM {tbl('wh360_inbound_v')}
        WHERE po_id = :po_id
        ORDER BY po_item
    """

    rows = await run_sql_async(token, items_q, params, endpoint_hint="wh360.receipt_detail.items")

    return {
        "receipt": rows[0] if rows else None,
        "items": rows,
    }
