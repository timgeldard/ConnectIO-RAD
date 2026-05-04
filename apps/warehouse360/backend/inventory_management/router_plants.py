"""Router - warehouse plant selection."""

from typing import Optional

from fastapi import APIRouter, Depends, Header, Request

from backend.inventory_management.dal.plants import fetch_plants
from backend.utils.db import attach_data_freshness, check_warehouse_config
from shared_auth import UserIdentity, require_proxy_user

router = APIRouter()

_FRESHNESS_SOURCES = [
    "wh360_process_orders_v",
    "wh360_deliveries_v",
    "wh360_inbound_v",
    "wh360_lineside_stock_v",
    "wh360_dispensary_tasks_v",
]


@router.get("/plants")
async def list_plants(
    request: Request,
    user: UserIdentity = Depends(require_proxy_user),
):
    token = user.raw_token
    check_warehouse_config()
    rows = await fetch_plants(token)
    return await attach_data_freshness(
        {"plants": rows},
        token,
        _FRESHNESS_SOURCES,
        request_path=str(request.url.path),
    )
