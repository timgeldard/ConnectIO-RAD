"""DAL for Lineside Monitor — live wallboard summary from POH and W360 views."""
import asyncio
import logging
from typing import Any, Optional

from processorderhistory_backend.db import run_sql_async, sql_param, tbl

logger = logging.getLogger(__name__)


async def _q_active_orders(token: str, plant_id: Optional[str]) -> list[dict]:
    """Fetch active process orders with recent confirmation activity.

    Args:
        token: Databricks access token forwarded from the request.
        plant_id: Optional plant filter; when omitted, all authorized plants are
            included by the query caller.

    Returns:
        List of active order records with process order, plant, line, status,
        material, start, and last-activity fields.
    """
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
    """Fetch recent downtime events for lineside display.

    Args:
        token: Databricks access token forwarded from the request.
        plant_id: Optional plant filter; when omitted, all authorized plants are
            included by the query caller.

    Returns:
        List of downtime records with line, order, reason, issue, start, and
        duration fields.
    """
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
    """Fetch upcoming released or not-started process orders.

    Args:
        token: Databricks access token forwarded from the request.
        plant_id: Optional plant filter; when omitted, all authorized plants are
            included by the query caller.

    Returns:
        List of upcoming order records with process order, plant, line, status,
        and material context.
    """
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
    """Fetch line-side stock from the Warehouse360 stock view.

    Args:
        token: Databricks access token forwarded from the request.
        plant_id: Optional plant filter; when omitted, all authorized plants are
            included by the query caller.

    Returns:
        List of stock records with plant, bin, storage type, material, available
        quantity, and unit of measure.
    """
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
        FROM {tbl('wh360.wh360_lineside_stock_v')}
        {plant_clause}
        ORDER BY plant_id, bin_id
        LIMIT 500
    """
    return await run_sql_async(token, query, params, endpoint_hint="poh.lineside.stock")


def _line_key(row: dict) -> str:
    """Extract a stable grouping key for a production line or bin row.

    Args:
        row: Query result row containing ``line_id`` or ``bin_id``.

    Returns:
        Line identifier, bin identifier, or ``UNKNOWN`` when neither exists.
    """
    return str(row.get("line_id") or row.get("bin_id") or "UNKNOWN")


def _build_summary(active_orders: list[dict], downtime: list[dict], next_orders: list[dict], stock: list[dict]) -> dict:
    """Aggregate raw query rows into the Lineside Monitor summary contract.

    Args:
        active_orders: Active process order records from ``_q_active_orders``.
        downtime: Downtime records from ``_q_downtime``.
        next_orders: Upcoming order records from ``_q_next_orders``.
        stock: Line-side stock records from ``_q_lineside_stock``.

    Returns:
        Summary dictionary containing ``kpis``, ``lines``, ``activity``,
        ``lineside_stock``, and ``data_available`` keys.
    """
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


def _safe_result(result: Any, name: str) -> list[dict]:
    """Return the result list, or an empty list if the gather coroutine raised.

    Args:
        result: A value or BaseException returned by ``asyncio.gather`` with
            ``return_exceptions=True``.
        name: Human-readable sub-query name used in warning log messages.

    Returns:
        The original list on success, or ``[]`` if the coroutine raised.
    """
    if isinstance(result, BaseException):
        logger.warning("Lineside Monitor sub-query '%s' failed: %s", name, result)
        return []
    return result


async def fetch_lineside_monitor(token: str, *, plant_id: Optional[str] = None) -> dict:
    """Fetch and aggregate live Lineside Monitor wallboard data.

    Args:
        token: Databricks access token forwarded from the request.
        plant_id: Optional plant filter; when omitted, all authorized plants are
            included by the query caller.

    Returns:
        Summary dictionary containing production KPIs, line state cards, recent
        activity, line-side stock rows, and the ``data_available`` flag.
    """
    results = await asyncio.gather(
        _q_active_orders(token, plant_id),
        _q_downtime(token, plant_id),
        _q_next_orders(token, plant_id),
        _q_lineside_stock(token, plant_id),
        return_exceptions=True,
    )
    active_orders = _safe_result(results[0], "active_orders")
    downtime      = _safe_result(results[1], "downtime")
    next_orders   = _safe_result(results[2], "next_orders")
    stock         = _safe_result(results[3], "stock")
    return _build_summary(active_orders, downtime, next_orders, stock)
