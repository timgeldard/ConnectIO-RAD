"""Router — process orders."""

from typing import Optional

from shared_auth import UserIdentity, require_proxy_user
from fastapi import Depends, APIRouter, HTTPException, Request

from warehouse360_backend.order_fulfillment.application import queries as fulfillment_queries
from warehouse360_backend.utils.db import attach_data_freshness, check_warehouse_config
from warehouse360_backend.utils.rate_limit import limiter

router = APIRouter()

_LIST_FRESHNESS_SOURCES = ["wh360_process_orders_v"]
_DETAIL_FRESHNESS_SOURCES = [
    "wh360_process_orders_v",
    "wh360_transfer_requirements_v",
    "wh360_transfer_orders_v",
    "wh360_dispensary_tasks_v",
]


@router.get("/wh-cockpit")
@limiter.limit("60/minute")
async def list_process_orders(request: Request,
    plant_id: Optional[str] = None,
    user: UserIdentity = Depends(require_proxy_user)
):
    """Return process order headers for a plant (warehouse cockpit view), with data freshness metadata."""
    token = user.raw_token
    check_warehouse_config()
    rows = await fulfillment_queries.list_process_orders(token, plant_id=plant_id)
    return await attach_data_freshness(
        {"orders": rows},
        token,
        _LIST_FRESHNESS_SOURCES,
        request_path=str(request.url.path),
    )


@router.get("/wh-cockpit/{order_id}")
@limiter.limit("60/minute")
async def get_process_order(order_id: str,
    request: Request,
    user: UserIdentity = Depends(require_proxy_user)
):
    """Return full detail for a single process order; raises 404 if not found."""
    token = user.raw_token
    check_warehouse_config()
    detail = await fulfillment_queries.get_process_order_detail(token, order_id)
    if detail.get("order") is None:
        raise HTTPException(status_code=404, detail=f"Process order '{order_id}' not found.")
    return await attach_data_freshness(
        {"order": detail},
        token,
        _DETAIL_FRESHNESS_SOURCES,
        request_path=str(request.url.path),
    )
