"""Orders router — process order list endpoint."""
from typing import Optional

from fastapi import APIRouter, Header

from backend.dal.orders_dal import fetch_orders_list
from backend.db import check_warehouse_config, resolve_token
from backend.schemas.order_schemas import OrderListRequest

router = APIRouter()


@router.post("/orders")
async def list_orders(
    body: OrderListRequest,
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """Return process order summaries for the list view.

    Returns a JSON object ``{"orders": [...], "total": N}`` where each order
    has the keys consumed by the React OrderList component.
    """
    token = resolve_token(x_forwarded_access_token, authorization)
    check_warehouse_config()
    rows = await fetch_orders_list(
        token,
        plant_id=body.plant_id,
        limit=body.limit,
    )
    return {"orders": rows, "total": len(rows)}
