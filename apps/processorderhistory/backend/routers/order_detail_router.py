"""Order detail router — single-order detail endpoint."""
from typing import Optional

from shared_auth import UserIdentity, require_user
from fastapi import Depends, APIRouter, Header
from fastapi.responses import JSONResponse

from backend.dal.order_detail_dal import fetch_order_detail
from backend.db import check_warehouse_config

router = APIRouter()


@router.get("/orders/{order_id}")
async def get_order_detail(order_id: str,
    user: UserIdentity = Depends(require_user)
):
    """Return full detail payload for a single process order.

    Returns a JSON object with keys: order, time_summary, movement_summary,
    phases, materials, movements, comments, downtime, equipment, inspections,
    usage_decision.  404 if the order_id does not exist.
    """
    token = user.raw_token
    check_warehouse_config()
    detail = await fetch_order_detail(token, order_id=order_id)
    if detail is None:
        return JSONResponse(
            status_code=404,
            content={"detail": f"Order {order_id!r} not found"},
        )
    return detail
