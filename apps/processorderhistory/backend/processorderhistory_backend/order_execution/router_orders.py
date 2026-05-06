"""Orders router — process order list endpoint."""

from fastapi import APIRouter, Depends

from processorderhistory_backend.order_execution.application import queries as order_queries
from processorderhistory_backend.db import check_warehouse_config
from processorderhistory_backend.schemas.order_schemas import OrderListRequest
from processorderhistory_backend.utils.rate_limit import limiter
from shared_auth import UserIdentity, require_proxy_user

router = APIRouter()


@router.post("/orders")
@limiter.limit("60/minute")
async def list_orders(
    body: OrderListRequest,
    user: UserIdentity = Depends(require_proxy_user),
):
    """Return process order summaries for the list view.

    Returns a JSON object ``{"orders": [...], "total": N}`` where each order
    has the keys consumed by the React OrderList component.
    """
    token = user.raw_token
    check_warehouse_config()
    rows = await order_queries.list_orders(
        token,
        plant_id=body.plant_id,
        limit=body.limit,
    )
    return {"orders": rows, "total": len(rows)}
