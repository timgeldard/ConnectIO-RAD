"""Router - warehouse plant selection."""


from fastapi import APIRouter, Depends, Request

from backend.inventory_management.application import queries as inventory_queries
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
    rows = await inventory_queries.list_plants(token)
    return await attach_data_freshness(
        {"plants": rows},
        token,
        _FRESHNESS_SOURCES,
        request_path=str(request.url.path),
    )
