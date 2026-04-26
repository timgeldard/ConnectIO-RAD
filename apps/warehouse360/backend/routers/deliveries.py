"""Router — outbound deliveries."""

from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Request

from backend.dal.deliveries import fetch_deliveries, fetch_delivery_detail
from backend.utils.db import attach_data_freshness, check_warehouse_config, resolve_token

router = APIRouter()

_LIST_FRESHNESS_SOURCES = ["wh360_deliveries_v"]
_DETAIL_FRESHNESS_SOURCES = [
    "wh360_deliveries_v",
    "wh360_transfer_orders_v",
    "wh360_handling_units_v",
]


@router.get("/deliveries")
async def list_deliveries(
    request: Request,
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    token = resolve_token(x_forwarded_access_token, authorization)
    check_warehouse_config()
    rows = await fetch_deliveries(token)
    return await attach_data_freshness(
        {"deliveries": rows},
        token,
        _LIST_FRESHNESS_SOURCES,
        request_path=str(request.url.path),
    )


@router.get("/deliveries/{delivery_id}")
async def get_delivery(
    delivery_id: str,
    request: Request,
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    token = resolve_token(x_forwarded_access_token, authorization)
    check_warehouse_config()
    detail = await fetch_delivery_detail(token, delivery_id)
    if detail.get("delivery") is None:
        raise HTTPException(status_code=404, detail=f"Delivery '{delivery_id}' not found.")
    return await attach_data_freshness(
        {"delivery": detail},
        token,
        _DETAIL_FRESHNESS_SOURCES,
        request_path=str(request.url.path),
    )
