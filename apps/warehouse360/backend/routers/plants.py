"""Router - warehouse plant selection."""

from typing import Optional

from fastapi import APIRouter, Header, Request

from backend.dal.plants import fetch_plants
from backend.utils.db import attach_data_freshness, check_warehouse_config, resolve_token

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
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    token = resolve_token(x_forwarded_access_token, authorization)
    check_warehouse_config()
    rows = await fetch_plants(token)
    return await attach_data_freshness(
        {"plants": rows},
        token,
        _FRESHNESS_SOURCES,
        request_path=str(request.url.path),
    )
