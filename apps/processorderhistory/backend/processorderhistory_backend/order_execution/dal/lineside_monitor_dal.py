"""DAL for Lineside Monitor — live wallboard summary from POH and W360 views."""
import asyncio
from typing import Optional

from processorderhistory_backend.db import POH_CATALOG, run_sql_async, sql_param, tbl


async def _q_active_orders(token: str, plant_id: Optional[str]) -> list[dict]:
    plant_clause = "AND po.PLANT_ID = :plant_id" if plant_id else ""
    params = [sql_param("plant_id", plant_id)] if plant_id else None
    query = f"""
        WITH confirmation_agg AS (
            SELECT
                PROCESS_ORDER_ID,
                MIN(START_TIMESTAMP) AS start_ts,
                MAX(END_TIMESTAMP)   AS end_ts
            FROM {tbl('vw_gold_confirmation')}
            WHERE START_TIMESTAMP >= current_timestamp() - INTERVAL 24 HOURS
            GROUP BY PROCESS_ORDER_ID
        )
        SELECT
            po.PROCESS_ORDER_ID                                AS process_order_id,
            po.PLANT_ID                                        AS plant_id,
            COALESCE(plan.PROCESS_LINE, 'UNKNOWN')             AS line_id,
            po.STATUS                                          AS status,
            po.MATERIAL_ID                                     AS material_id,
            COALESCE(mat.MATERIAL_NAME, po.MATERIAL_DESCRIPTION, po.MATERIAL_ID) AS material_name,
            CAST(UNIX_TIMESTAMP(ca.start_ts) * 1000 AS BIGINT) AS start_ms,
            CAST(UNIX_TIMESTAMP(ca.end_ts) * 1000 AS BIGINT)   AS last_activity_ms
        FROM {tbl('vw_gold_process_order')} po
        JOIN confirmation_agg ca
          ON ca.PROCESS_ORDER_ID = po.PROCESS_ORDER_ID
        LEFT JOIN {tbl('vw_gold_process_order_plan')} plan
          ON plan.PROCESS_ORDER_ID = po.PROCESS_ORDER_ID
        LEFT JOIN {tbl('vw_gold_material')} mat
          ON mat.MATERIAL_ID = po.MATERIAL_ID
         AND mat.LANGUAGE_ID = 'E'
        WHERE po.STATUS IN ('IN PROGRESS', 'Tulip Load In Progress', 'ON HOLD')
          {plant_clause}
        ORDER BY line_id, ca.start_ts DESC
        LIMIT 200
    """
    return await run_sql_async(token, query, params, endpoint_hint="poh.lineside.active_orders")


async def _q_downtime(token: str, plant_id: Optional[str]) -> list[dict]:
    plant_clause = "AND po.PLANT_ID = :plant_id" if plant_id else ""
    params = [sql_param("plant_id", plant_id)] if plant_id else None
    query = f"""
        SELECT
            COALESCE(plan.PROCESS_LINE, 'UNKNOWN')              AS line_id,
            dt.PROCESS_ORDER_ID                                 AS process_order_id,
            dt.REASON_CODE                                      AS reason_code,
            dt.ISSUE_TITLE                                      AS issue_title,
            CAST(UNIX_TIMESTAMP(dt.START_TIME) * 1000 AS BIGINT) AS start_ms,
            dt.DURATION                                         AS duration_s
        FROM {tbl('vw_gold_downtime_and_issues')} dt
        JOIN {tbl('vw_gold_process_order')} po
          ON po.PROCESS_ORDER_ID = dt.PROCESS_ORDER_ID
        LEFT JOIN {tbl('vw_gold_process_order_plan')} plan
          ON plan.PROCESS_ORDER_ID = dt.PROCESS_ORDER_ID
        WHERE dt.START_TIME >= current_timestamp() - INTERVAL 24 HOURS
          {plant_clause}
        ORDER BY dt.START_TIME DESC
        LIMIT 100
    """
    return await run_sql_async(token, query, params, endpoint_hint="poh.lineside.downtime")


async def _q_next_orders(token: str, plant_id: Optional[str]) -> list[dict]:
    plant_clause = "AND po.PLANT_ID = :plant_id" if plant_id else ""
    params = [sql_param("plant_id", plant_id)] if plant_id else None
    query = f"""
        SELECT
            po.PROCESS_ORDER_ID                    AS process_order_id,
            po.PLANT_ID                            AS plant_id,
            COALESCE(plan.PROCESS_LINE, 'UNKNOWN') AS line_id,
            po.STATUS                              AS status,
            po.MATERIAL_ID                         AS material_id,
            COALESCE(mat.MATERIAL_NAME, po.MATERIAL_DESCRIPTION, po.MATERIAL_ID) AS material_name
        FROM {tbl('vw_gold_process_order')} po
        LEFT JOIN {tbl('vw_gold_process_order_plan')} plan
          ON plan.PROCESS_ORDER_ID = po.PROCESS_ORDER_ID
        LEFT JOIN {tbl('vw_gold_material')} mat
          ON mat.MATERIAL_ID = po.MATERIAL_ID
         AND mat.LANGUAGE_ID = 'E'
        WHERE po.STATUS IN ('NOT STARTED', 'RELEASED')
          {plant_clause}
        ORDER BY po.PROCESS_ORDER_ID DESC
        LIMIT 50
    """
    return await run_sql_async(token, query, params, endpoint_hint="poh.lineside.next_orders")


async def _q_lineside_stock(token: str, plant_id: Optional[str]) -> list[dict]:
    plant_clause = "WHERE plant_id = :plant_id" if plant_id else ""
    params = [sql_param("plant_id", plant_id)] if plant_id else None
    query = f"""
        SELECT
            plant_id,
            bin_id,
            storage_type,
            material_id,
            material_name,
            available,
            uom
        FROM `{POH_CATALOG}`.`wh360`.`wh360_lineside_stock_v`
        {plant_clause}
        ORDER BY plant_id, bin_id
        LIMIT 500
    """
    return await run_sql_async(token, query, params, endpoint_hint="poh.lineside.stock")


def _line_key(row: dict) -> str:
    return str(row.get("line_id") or row.get("bin_id") or "UNKNOWN")


def _build_summary(active_orders: list[dict], downtime: list[dict], next_orders: list[dict], stock: list[dict]) -> dict:
    line_ids = sorted({_line_key(row) for row in [*active_orders, *downtime, *next_orders] if _line_key(row)})
    lines = []
    for line_id in line_ids:
        orders = [row for row in active_orders if _line_key(row) == line_id]
        line_downtime = [row for row in downtime if _line_key(row) == line_id]
        upcoming = [row for row in next_orders if _line_key(row) == line_id][:3]
        status = "blocked" if line_downtime else "running" if orders else "idle"
        current = orders[0] if orders else None
        lines.append({
            "line_id": line_id,
            "status": status,
            "current_order": current,
            "next_orders": upcoming,
            "downtime": line_downtime[:3],
        })

    return {
        "kpis": {
            "lines_active": sum(1 for line in lines if line["status"] == "running"),
            "orders_running": len(active_orders),
            "blocked": sum(1 for line in lines if line["status"] == "blocked"),
            "awaiting_picks": len(next_orders),
            "lineside_materials": len(stock),
        },
        "lines": lines,
        "activity": sorted([*active_orders, *downtime], key=lambda row: int(row.get("last_activity_ms") or row.get("start_ms") or 0), reverse=True)[:20],
        "lineside_stock": stock[:100],
        "data_available": bool(active_orders or downtime or next_orders or stock),
    }


async def fetch_lineside_monitor(token: str, *, plant_id: Optional[str] = None) -> dict:
    active_orders, downtime, next_orders, stock = await asyncio.gather(
        _q_active_orders(token, plant_id),
        _q_downtime(token, plant_id),
        _q_next_orders(token, plant_id),
        _q_lineside_stock(token, plant_id),
    )
    return _build_summary(active_orders, downtime, next_orders, stock)
