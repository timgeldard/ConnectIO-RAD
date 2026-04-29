"""DAL for the process order list view.

Queries:
  - vw_gold_process_order  — order header, status, material
  - vw_gold_material       — human-readable material name (LANGUAGE_ID='E')
  - vw_gold_confirmation   — MIN/MAX timestamps for order start and end
  - vw_gold_adp_movement   — MOVEMENT_TYPE='101' goods-receipt qty (actual output)

Status mapping (SAP → UI):
  IN PROGRESS / Tulip Load In Progress  → running
  COMPLETED / CLOSED (TECO)             → completed
  ON HOLD                               → onhold
  CANCELLED                             → cancelled
  everything else (NOT STARTED, etc.)  → released
"""
from typing import Optional

from backend.db import ORDER_STATUS_EXPR, run_sql_async, sql_param, tbl


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

    Args:
        token: Databricks access token.
        plant_id: Optional PLANT_ID filter; None means all plants.
        limit: Maximum rows to return (caller is responsible for clamping).

    Returns:
        List of dicts with keys: process_order_id, inspection_lot_id, material_id,
        material_name, material_category, plant_id, status, start_ms, duration_h,
        actual_qty, qty_uom.
    """
    plant_clause = "WHERE po.PLANT_ID = :plant_id" if plant_id else ""
    params: list[dict] = []
    if plant_id:
        params.append(sql_param("plant_id", plant_id))

    query = f"""
        WITH confirmation_agg AS (
            SELECT
                PROCESS_ORDER_ID,
                MIN(START_TIMESTAMP) AS start_ts,
                MAX(END_TIMESTAMP)   AS end_ts
            FROM {tbl('vw_gold_confirmation')}
            GROUP BY PROCESS_ORDER_ID
        ),
        receipt_agg AS (
            SELECT
                PROCESS_ORDER_ID,
                SUM(CASE
                    WHEN MOVEMENT_TYPE = '101' THEN
                        CASE
                            WHEN UPPER(TRIM(UOM)) = 'EA' THEN 0
                            WHEN UPPER(TRIM(UOM)) = 'G' THEN QUANTITY / 1000.0
                            ELSE QUANTITY
                        END
                    WHEN MOVEMENT_TYPE = '102' THEN
                        -(CASE
                            WHEN UPPER(TRIM(UOM)) = 'EA' THEN 0
                            WHEN UPPER(TRIM(UOM)) = 'G' THEN QUANTITY / 1000.0
                            ELSE QUANTITY
                        END)
                    ELSE 0
                END)       AS actual_qty,
                'KG'       AS qty_uom
            FROM {tbl('vw_gold_adp_movement')}
            WHERE MOVEMENT_TYPE IN ('101', '102')
            GROUP BY PROCESS_ORDER_ID
        )
        SELECT
            po.PROCESS_ORDER_ID                                        AS process_order_id,
            po.INSPECTION_LOT_ID                                       AS inspection_lot_id,
            po.MATERIAL_ID                                             AS material_id,
            COALESCE(m.MATERIAL_NAME, po.MATERIAL_DESCRIPTION)         AS material_name,
            m.MATERIAL_CATEGORY                                        AS material_category,
            po.PLANT_ID                                                AS plant_id,
            {ORDER_STATUS_EXPR}                                        AS status,
            CAST(UNIX_TIMESTAMP(ca.start_ts) * 1000 AS BIGINT)        AS start_ms,
            CAST(UNIX_TIMESTAMP(ca.end_ts)   * 1000 AS BIGINT)        AS end_ms,
            CASE
                WHEN ca.start_ts IS NOT NULL AND ca.end_ts IS NOT NULL
                THEN ROUND(
                    (UNIX_TIMESTAMP(ca.end_ts) - UNIX_TIMESTAMP(ca.start_ts)) / 3600.0,
                    1
                )
                ELSE NULL
            END                                                        AS duration_h,
            ra.actual_qty                                              AS actual_qty,
            ra.qty_uom                                                 AS qty_uom
        FROM {tbl('vw_gold_process_order')} po
        LEFT JOIN {tbl('vw_gold_material')} m
            ON m.MATERIAL_ID = po.MATERIAL_ID
           AND m.LANGUAGE_ID = 'E'
        LEFT JOIN confirmation_agg ca ON ca.PROCESS_ORDER_ID = po.PROCESS_ORDER_ID
        LEFT JOIN receipt_agg ra      ON ra.PROCESS_ORDER_ID = po.PROCESS_ORDER_ID
        {plant_clause}
        ORDER BY ca.start_ts DESC NULLS LAST
        LIMIT {limit}  -- safe: validated int clamped to [1, 5000] by OrderListRequest
    """

    rows = await run_sql_async(token, query, params, endpoint_hint="poh.orders.list")
    return [_coerce_row(r) for r in rows]
