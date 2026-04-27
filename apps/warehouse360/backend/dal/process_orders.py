"""DAL — process orders (AFKO/AFPO) and their staging tasks."""

import asyncio

from backend.utils.db import run_sql_async, sql_param, tbl


async def fetch_process_orders(token: str, plant_id: str | None = None) -> list[dict]:
    """Return current process orders ordered by scheduled start time."""
    params = [sql_param("plant_id", plant_id)] if plant_id else []
    plant_filter = "WHERE plant_id = :plant_id" if plant_id else ""
    q = f"""
        SELECT *
        FROM {tbl('wh360_process_orders_v')}
        {plant_filter}
        ORDER BY sched_start
        LIMIT 500
    """
    return await run_sql_async(token, q, params, endpoint_hint="wh360.process_orders")


async def fetch_order_detail(token: str, order_id: str) -> dict:
    """Return one process order with its transfer requirements, transfer orders,
    and dispensary tasks fetched in parallel.

    Assumed column names (adjust once view DDL is confirmed):
    - wh360_process_orders_v.order_id         — SAP process order number
    - wh360_transfer_requirements_v.order_id  — SAP process order number (AFKO-AUFNR)
    - wh360_transfer_orders_v.order_id        — SAP process order reference on the TO.
      NOTE: wh360_transfer_orders_v also has ref_doc used for outbound delivery links
      (see dal/deliveries.py). order_id is the process-order-specific FK; if the view
      uses a single polymorphic ref_doc column instead, replace order_id with ref_doc.
    - wh360_dispensary_tasks_v.process_order_id — SAP process order number
    - wh360_transfer_requirements_v is a 9th view not listed in the task's named view
      set; it must be created alongside the other wh360_* views.
    """
    params = [sql_param("order_id", order_id)]

    order_q = f"""
        SELECT *
        FROM {tbl('wh360_process_orders_v')}
        WHERE order_id = :order_id
        LIMIT 1
    """
    tr_q = f"""
        SELECT *
        FROM {tbl('wh360_transfer_requirements_v')}
        WHERE order_id = :order_id
        ORDER BY created_at
    """
    to_q = f"""
        SELECT *
        FROM {tbl('wh360_transfer_orders_v')}
        WHERE order_id = :order_id
        ORDER BY created_at
    """
    disp_q = f"""
        SELECT *
        FROM {tbl('wh360_dispensary_tasks_v')}
        WHERE process_order_id = :order_id
        ORDER BY mins_to_start
    """

    order_rows, tr_rows, to_rows, disp_rows = await asyncio.gather(
        run_sql_async(token, order_q, params, endpoint_hint="wh360.order_detail.header"),
        run_sql_async(token, tr_q, params, endpoint_hint="wh360.order_detail.trs"),
        run_sql_async(token, to_q, params, endpoint_hint="wh360.order_detail.tos"),
        run_sql_async(token, disp_q, params, endpoint_hint="wh360.order_detail.dispensary"),
    )

    return {
        "order": order_rows[0] if order_rows else None,
        "transfer_requirements": tr_rows,
        "transfer_orders": to_rows,
        "dispensary_tasks": disp_rows,
    }
