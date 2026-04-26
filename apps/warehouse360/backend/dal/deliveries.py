"""DAL — outbound deliveries (LIKP/LIPS) and their transfer orders / HUs."""

import asyncio

from backend.utils.db import run_sql_async, sql_param, tbl


async def fetch_deliveries(token: str) -> list[dict]:
    """Return outbound deliveries ordered by planned goods-issue date."""
    q = f"""
        SELECT *
        FROM {tbl('wh360_deliveries_v')}
        ORDER BY planned_gi_date
        LIMIT 500
    """
    return await run_sql_async(token, q, [], endpoint_hint="wh360.deliveries")


async def fetch_delivery_detail(token: str, delivery_id: str) -> dict:
    """Return one delivery with its transfer orders and handling units fetched
    in parallel.

    NOTE: Column name `delivery_id` on wh360_deliveries_v and `ref_doc` on
    wh360_transfer_orders_v / wh360_handling_units_v are assumed from the SAP
    WM domain model; adjust once the view DDL is available.
    """
    delivery_params = [sql_param("delivery_id", delivery_id)]

    delivery_q = f"""
        SELECT *
        FROM {tbl('wh360_deliveries_v')}
        WHERE delivery_id = :delivery_id
        LIMIT 1
    """
    to_q = f"""
        SELECT *
        FROM {tbl('wh360_transfer_orders_v')}
        WHERE ref_doc = :delivery_id
        ORDER BY created_at
    """
    hu_q = f"""
        SELECT *
        FROM {tbl('wh360_handling_units_v')}
        WHERE ref_doc = :delivery_id
        ORDER BY sscc
    """

    delivery_rows, to_rows, hu_rows = await asyncio.gather(
        run_sql_async(token, delivery_q, delivery_params, endpoint_hint="wh360.delivery_detail.header"),
        run_sql_async(token, to_q, delivery_params, endpoint_hint="wh360.delivery_detail.tos"),
        run_sql_async(token, hu_q, delivery_params, endpoint_hint="wh360.delivery_detail.hus"),
    )

    return {
        "delivery": delivery_rows[0] if delivery_rows else None,
        "transfer_orders": to_rows,
        "handling_units": hu_rows,
    }
