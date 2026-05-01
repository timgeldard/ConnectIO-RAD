"""Orders router — process order list endpoint."""
from typing import Optional

from fastapi import APIRouter, Depends, Header

from backend.dal.orders_dal import fetch_orders_list
from backend.db import check_warehouse_config
from backend.schemas.order_schemas import OrderListRequest
from shared_auth import UserIdentity, require_user

router = APIRouter()


@router.post("/orders")
async def list_orders(
    body: OrderListRequest,
    user: UserIdentity = Depends(require_user),
):
    """Return process order summaries for the list view.

    Returns a JSON object ``{"orders": [...], "total": N}`` where each order
    has the keys consumed by the React OrderList component.
    """
    token = user.raw_token
    check_warehouse_config()
    rows = await fetch_orders_list(
        token,
        plant_id=body.plant_id,
        limit=body.limit,
    )
    return {"orders": rows, "total": len(rows)}
