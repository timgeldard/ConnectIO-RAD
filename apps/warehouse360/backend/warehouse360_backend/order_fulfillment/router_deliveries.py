"""Router — outbound deliveries."""

from typing import Optional

from shared_auth import UserIdentity, require_proxy_user
from fastapi import Depends, APIRouter, HTTPException, Request

from warehouse360_backend.order_fulfillment.application import queries as fulfillment_queries
from warehouse360_backend.utils.db import attach_data_freshness, check_warehouse_config
from warehouse360_backend.utils.rate_limit import limiter

router = APIRouter()

_LIST_FRESHNESS_SOURCES = ["wh360_deliveries_v"]
_DETAIL_FRESHNESS_SOURCES = [
    "wh360_deliveries_v",
    "wh360_transfer_orders_v",
    "wh360_handling_units_v",
]


@router.get("/deliveries")
@limiter.limit("60/minute")
async def list_deliveries(request: Request,
    plant_id: Optional[str] = None,
    user: UserIdentity = Depends(require_proxy_user)
):
    """Return outbound delivery headers for a plant, with data freshness metadata."""
    token = user.raw_token
    check_warehouse_config()
    rows = await fulfillment_queries.list_deliveries(token, plant_id=plant_id)
    return await attach_data_freshness(
        {"deliveries": rows},
        token,
        _LIST_FRESHNESS_SOURCES,
        request_path=str(request.url.path),
    )


@router.get("/deliveries/{delivery_id}")
@limiter.limit("60/minute")
async def get_delivery(delivery_id: str,
    request: Request,
    user: UserIdentity = Depends(require_proxy_user)
):
    """Return detail for a single delivery including transfer orders; raises 404 if not found."""
    token = user.raw_token
    check_warehouse_config()
    detail = await fulfillment_queries.get_delivery_detail(token, delivery_id)
    if detail.get("delivery") is None:
        raise HTTPException(status_code=404, detail=f"Delivery '{delivery_id}' not found.")
    return await attach_data_freshness(
        {"delivery": detail},
        token,
        _DETAIL_FRESHNESS_SOURCES,
        request_path=str(request.url.path),
    )
