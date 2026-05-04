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
    and dispensary tasks. Transfer requirements/orders are linked through the
    process order reservation number exposed by wh360_process_orders_v.
    """
    params = [sql_param("order_id", order_id)]

    order_q = f"""
        SELECT *
        FROM {tbl('wh360_process_orders_v')}
        WHERE order_id = :order_id
        LIMIT 1
    """
    disp_q = f"""
        SELECT *
        FROM {tbl('wh360_dispensary_tasks_v')}
        WHERE order_id = :order_id
        ORDER BY mins_to_start
    """

    order_rows, disp_rows = await asyncio.gather(
        run_sql_async(token, order_q, params, endpoint_hint="wh360.order_detail.header"),
        run_sql_async(token, disp_q, params, endpoint_hint="wh360.order_detail.dispensary"),
    )
    order = order_rows[0] if order_rows else None
    reservation_no = order.get("reservation_no") if order else None

    tr_rows: list[dict] = []
    to_rows: list[dict] = []
    if reservation_no:
        reservation_params = [sql_param("reservation_no", reservation_no)]
        tr_q = f"""
            SELECT *
            FROM {tbl('wh360_transfer_requirements_v')}
            WHERE reservation_no = :reservation_no
            ORDER BY created_date
        """
        to_q = f"""
            SELECT *
            FROM {tbl('wh360_transfer_orders_v')}
            WHERE reservation_no = :reservation_no
            ORDER BY created_date
        """
        tr_rows, to_rows = await asyncio.gather(
            run_sql_async(token, tr_q, reservation_params, endpoint_hint="wh360.order_detail.trs"),
            run_sql_async(token, to_q, reservation_params, endpoint_hint="wh360.order_detail.tos"),
        )

    return {
        "order": order,
        "transfer_requirements": tr_rows,
        "transfer_orders": to_rows,
        "dispensary_tasks": disp_rows,
    }
