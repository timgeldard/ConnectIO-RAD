"""DAL — inbound deliveries / purchase orders (EKKO/EKPO, LIKP GR side)."""

import asyncio

from backend.utils.db import run_sql_async, sql_param, tbl


async def fetch_inbound(token: str) -> list[dict]:
    """Return inbound receipts ordered by expected delivery date."""
    q = f"""
        SELECT *
        FROM {tbl('wh360_inbound_v')}
        ORDER BY delivery_date
        LIMIT 500
    """
    return await run_sql_async(token, q, [], endpoint_hint="wh360.inbound")


async def fetch_receipt_detail(token: str, po_id: str) -> dict:
    """Return one purchase/STO order with its line items fetched in parallel.

    NOTE: Column name `po_id` on wh360_inbound_v / wh360_inbound_items_v is
    assumed from the SAP WM domain model; adjust once the view DDL is available.
    """
    params = [sql_param("po_id", po_id)]

    header_q = f"""
        SELECT *
        FROM {tbl('wh360_inbound_v')}
        WHERE po_id = :po_id
        LIMIT 1
    """
    items_q = f"""
        SELECT *
        FROM {tbl('wh360_inbound_items_v')}
        WHERE po_id = :po_id
        ORDER BY line_no
    """

    header_rows, item_rows = await asyncio.gather(
        run_sql_async(token, header_q, params, endpoint_hint="wh360.receipt_detail.header"),
        run_sql_async(token, items_q, params, endpoint_hint="wh360.receipt_detail.items"),
    )

    return {
        "receipt": header_rows[0] if header_rows else None,
        "items": item_rows,
    }
