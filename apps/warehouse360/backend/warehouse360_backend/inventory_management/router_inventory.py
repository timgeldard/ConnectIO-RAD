"""Router — warehouse inventory (bin stock + line-side)."""

from typing import Optional

from shared_auth import UserIdentity, require_proxy_user
from fastapi import Depends, APIRouter, Request

from warehouse360_backend.inventory_management.application import queries as inventory_queries
from warehouse360_backend.utils.db import attach_data_freshness, check_warehouse_config
from warehouse360_backend.utils.rate_limit import limiter

router = APIRouter()

_BIN_FRESHNESS_SOURCES = ["wh360_bin_stock_v"]
_LINESIDE_FRESHNESS_SOURCES = ["wh360_lineside_stock_v"]


@router.get("/inventory/bins/summary")
@limiter.limit("60/minute")
async def list_bins_summary(
    request: Request,
    plant_id: Optional[str] = None,
    user: UserIdentity = Depends(require_proxy_user),
):
    """Return per-storage-type aggregate bin utilisation for the overview card."""
    token = user.raw_token
    check_warehouse_config()
    rows = await inventory_queries.list_bin_stock_summary(token, plant_id=plant_id)
    return await attach_data_freshness(
        {"types": rows},
        token,
        _BIN_FRESHNESS_SOURCES,
        request_path=str(request.url.path),
    )


@router.get("/inventory/bins")
@limiter.limit("60/minute")
async def list_bins(
    request: Request,
    plant_id: Optional[str] = None,
    lgtyp: Optional[str] = None,
    user: UserIdentity = Depends(require_proxy_user),
):
    """Return bin stock levels for a plant, with data freshness metadata.

    Pass ``lgtyp`` to restrict results to a single storage type (drill-down).
    """
    token = user.raw_token
    check_warehouse_config()
    rows = await inventory_queries.list_bin_stock(token, plant_id=plant_id, lgtyp=lgtyp)
    return await attach_data_freshness(
        {"bins": rows},
        token,
        _BIN_FRESHNESS_SOURCES,
        request_path=str(request.url.path),
    )


@router.get("/inventory/lineside")
@limiter.limit("60/minute")
async def list_lineside(request: Request,
    plant_id: Optional[str] = None,
    user: UserIdentity = Depends(require_proxy_user)
):
    """Return line-side stock levels for a plant, with data freshness metadata."""
    token = user.raw_token
    check_warehouse_config()
    rows = await inventory_queries.list_lineside_stock(token, plant_id=plant_id)
    return await attach_data_freshness(
        {"lineside": rows},
        token,
        _LINESIDE_FRESHNESS_SOURCES,
        request_path=str(request.url.path),
    )


@router.get("/inventory/near-expiry")
@limiter.limit("60/minute")
async def list_near_expiry(
    request: Request,
    plant_id: Optional[str] = None,
    user: UserIdentity = Depends(require_proxy_user),
):
    """Return batch-level near-expiry stock (within 90 days), ordered by expiry date."""
    token = user.raw_token
    check_warehouse_config()
    rows = await inventory_queries.list_near_expiry_batches(token, plant_id=plant_id)
    return await attach_data_freshness(
        {"batches": rows},
        token,
        ["wh360_near_expiry_batches_v"],
        request_path=str(request.url.path),
    )
