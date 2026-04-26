"""Router — warehouse inventory (bin stock + line-side)."""

from typing import Optional

from fastapi import APIRouter, Header, Request

from backend.dal.inventory import fetch_bin_stock, fetch_lineside
from backend.utils.db import attach_data_freshness, check_warehouse_config, resolve_token

router = APIRouter()

_BIN_FRESHNESS_SOURCES = ["wh360_bin_stock_v"]
_LINESIDE_FRESHNESS_SOURCES = ["wh360_lineside_stock_v"]


@router.get("/inventory/bins")
async def list_bins(
    request: Request,
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    token = resolve_token(x_forwarded_access_token, authorization)
    check_warehouse_config()
    rows = await fetch_bin_stock(token)
    return await attach_data_freshness(
        {"bins": rows},
        token,
        _BIN_FRESHNESS_SOURCES,
        request_path=str(request.url.path),
    )


@router.get("/inventory/lineside")
async def list_lineside(
    request: Request,
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    token = resolve_token(x_forwarded_access_token, authorization)
    check_warehouse_config()
    rows = await fetch_lineside(token)
    return await attach_data_freshness(
        {"lineside": rows},
        token,
        _LINESIDE_FRESHNESS_SOURCES,
        request_path=str(request.url.path),
    )
