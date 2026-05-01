"""Router — process orders."""

from typing import Optional

from shared_auth import UserIdentity, require_proxy_user
from fastapi import Depends, APIRouter, Header, HTTPException, Request

from backend.dal.process_orders import fetch_order_detail, fetch_process_orders
from backend.utils.db import attach_data_freshness, check_warehouse_config

router = APIRouter()

_LIST_FRESHNESS_SOURCES = ["wh360_process_orders_v"]
_DETAIL_FRESHNESS_SOURCES = [
    "wh360_process_orders_v",
    "wh360_transfer_requirements_v",
    "wh360_transfer_orders_v",
    "wh360_dispensary_tasks_v",
]


@router.get("/process-orders")
async def list_process_orders(request: Request,
    plant_id: Optional[str] = None,
    user: UserIdentity = Depends(require_proxy_user)
):
    token = user.raw_token
    check_warehouse_config()
    rows = await fetch_process_orders(token, plant_id=plant_id)
    return await attach_data_freshness(
        {"orders": rows},
        token,
        _LIST_FRESHNESS_SOURCES,
        request_path=str(request.url.path),
    )


@router.get("/process-orders/{order_id}")
async def get_process_order(order_id: str,
    request: Request,
    user: UserIdentity = Depends(require_proxy_user)
):
    token = user.raw_token
    check_warehouse_config()
    detail = await fetch_order_detail(token, order_id)
    if detail.get("order") is None:
        raise HTTPException(status_code=404, detail=f"Process order '{order_id}' not found.")
    return await attach_data_freshness(
        {"order": detail},
        token,
        _DETAIL_FRESHNESS_SOURCES,
        request_path=str(request.url.path),
    )
