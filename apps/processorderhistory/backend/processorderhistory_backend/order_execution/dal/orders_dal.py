"""DAL for the process order list view.

Source: ``vw_gold_order_summary`` (pre-joined gold view).
Replaces a 3-CTE query that scanned ``vw_gold_process_order``,
``vw_gold_confirmation`` (MIN/MAX confirmation timestamps),
``vw_gold_adp_movement`` (goods-receipt qty), and ``vw_gold_material``.

Status mapping (SAP → UI):
  IN PROGRESS / Tulip Load In Progress  → running
  COMPLETED / CLOSED (TECO)             → completed
  ON HOLD                               → onhold
  CANCELLED                             → cancelled
  everything else (NOT STARTED, etc.)  → released
"""
from typing import Optional

from processorderhistory_backend.db import ORDER_STATUS_EXPR, run_sql_async, sql_param, tbl


def _coerce_row(row: dict) -> dict:
    """Convert Databricks string-serialised numerics/timestamps to Python types."""
    aq = row.get("actual_qty")
    row["actual_qty"] = float(aq) if aq is not None else None

    sm = row.get("start_ms")
    row["start_ms"] = int(sm) if sm is not None else None

    em = row.get("end_ms")
    row["end_ms"] = int(em) if em is not None else None

    dh = row.get("duration_h")
    row["duration_h"] = float(dh) if dh is not None else None

    return row


async def fetch_orders_list(
    token: str,
    *,
    plant_id: Optional[str] = None,
    limit: int = 2000,
) -> list[dict]:
    """Return up to *limit* process order summaries ordered by confirmation start desc.

    Source: ``vw_gold_order_summary`` pre-joined gold view.

    Args:
        token: Databricks access token.
        plant_id: Optional PLANT_ID filter; None means all plants.
        limit: Maximum rows to return (caller is responsible for clamping).

    Returns:
        List of dicts with keys: process_order_id, inspection_lot_id, material_id,
        material_name, material_category, plant_id, status, start_ms, end_ms,
        duration_h, actual_qty, qty_uom.
    """
    plant_clause = "WHERE po.PLANT_ID = :plant_id" if plant_id else ""
    params: list[dict] = [sql_param("limit", limit)]
    if plant_id:
        params.append(sql_param("plant_id", plant_id))

    query = f"""
        SELECT
            po.PROCESS_ORDER_ID                                        AS process_order_id,
            po.INSPECTION_LOT_ID                                       AS inspection_lot_id,
            po.MATERIAL_ID                                             AS material_id,
            po.material_name,
            po.MATERIAL_CATEGORY                                       AS material_category,
            po.PLANT_ID                                                AS plant_id,
            {ORDER_STATUS_EXPR}                                        AS status,
            CAST(UNIX_TIMESTAMP(po.start_ts) * 1000 AS BIGINT)        AS start_ms,
            CAST(UNIX_TIMESTAMP(po.end_ts)   * 1000 AS BIGINT)        AS end_ms,
            po.duration_h,
            ROUND(po.actual_qty_kg, 2)                                 AS actual_qty,
            'KG'                                                       AS qty_uom
        FROM {tbl('vw_gold_order_summary')} po
        {plant_clause}
        ORDER BY po.start_ts DESC NULLS LAST
        LIMIT :limit
    """

    rows = await run_sql_async(token, query, params, endpoint_hint="poh.orders.list")
    return [_coerce_row(r) for r in rows]
