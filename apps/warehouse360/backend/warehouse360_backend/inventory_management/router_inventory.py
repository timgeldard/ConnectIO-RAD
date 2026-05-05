"""Router — warehouse inventory (bin stock + line-side)."""

from typing import Optional

from shared_auth import UserIdentity, require_proxy_user
from fastapi import Depends, APIRouter, Request

from warehouse360_backend.inventory_management.application import queries as inventory_queries
from warehouse360_backend.utils.db import attach_data_freshness, check_warehouse_config

router = APIRouter()

_BIN_FRESHNESS_SOURCES = ["wh360_bin_stock_v"]
_LINESIDE_FRESHNESS_SOURCES = ["wh360_lineside_stock_v"]


@router.get("/inventory/bins")
async def list_bins(request: Request,
    plant_id: Optional[str] = None,
    user: UserIdentity = Depends(require_proxy_user)
):
    token = user.raw_token
    check_warehouse_config()
    rows = await inventory_queries.list_bin_stock(token, plant_id=plant_id)
    return await attach_data_freshness(
        {"bins": rows},
        token,
        _BIN_FRESHNESS_SOURCES,
        request_path=str(request.url.path),
    )


@router.get("/inventory/lineside")
async def list_lineside(request: Request,
    plant_id: Optional[str] = None,
    user: UserIdentity = Depends(require_proxy_user)
):
    token = user.raw_token
    check_warehouse_config()
    rows = await inventory_queries.list_lineside_stock(token, plant_id=plant_id)
    return await attach_data_freshness(
        {"lineside": rows},
        token,
        _LINESIDE_FRESHNESS_SOURCES,
        request_path=str(request.url.path),
    )
