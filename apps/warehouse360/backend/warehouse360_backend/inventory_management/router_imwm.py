"""Router — IMWM (IM vs WM) inventory cockpit endpoints."""

from typing import Optional

from fastapi import APIRouter, Depends, Request
from shared_auth import UserIdentity, require_proxy_user

from warehouse360_backend.inventory_management.application import queries as inventory_queries
from warehouse360_backend.utils.db import attach_data_freshness, check_warehouse_config
from warehouse360_backend.utils.rate_limit import limiter

router = APIRouter()

_STOCK_FRESHNESS_SOURCES = ["imwm_stock_comparison_v"]
_MOVEMENTS_FRESHNESS_SOURCES = ["imwm_movements_v"]
_EXCEPTIONS_FRESHNESS_SOURCES = ["imwm_exceptions_v"]
_AGING_FRESHNESS_SOURCES = ["imwm_analytics_aging_v"]


@router.get("/imwm/stock")
@limiter.limit("60/minute")
async def list_imwm_stock(
    request: Request,
    plant: Optional[str] = None,
    user: UserIdentity = Depends(require_proxy_user),
):
    """Return IM vs WM stock comparison rows, with data freshness metadata."""
    token = user.raw_token
    check_warehouse_config()
    rows = await inventory_queries.list_imwm_stock(token, plant_id=plant)
    return await attach_data_freshness(
        {"stock": rows},
        token,
        _STOCK_FRESHNESS_SOURCES,
        request_path=str(request.url.path),
    )


@router.get("/imwm/movements")
@limiter.limit("60/minute")
async def list_imwm_movements(
    request: Request,
    plant: Optional[str] = None,
    user: UserIdentity = Depends(require_proxy_user),
):
    """Return recent goods movements for the IMWM Overview activity strip."""
    token = user.raw_token
    check_warehouse_config()
    rows = await inventory_queries.list_imwm_movements(token, plant_id=plant)
    return await attach_data_freshness(
        {"movements": rows},
        token,
        _MOVEMENTS_FRESHNESS_SOURCES,
        request_path=str(request.url.path),
    )


@router.get("/imwm/exceptions")
@limiter.limit("60/minute")
async def list_imwm_exceptions(
    request: Request,
    plant: Optional[str] = None,
    user: UserIdentity = Depends(require_proxy_user),
):
    """Return the rule-generated IMWM exception queue."""
    token = user.raw_token
    check_warehouse_config()
    rows = await inventory_queries.list_imwm_exceptions(token, plant_id=plant)
    return await attach_data_freshness(
        {"exceptions": rows},
        token,
        _EXCEPTIONS_FRESHNESS_SOURCES,
        request_path=str(request.url.path),
    )


@router.get("/imwm/analytics/aging")
@limiter.limit("60/minute")
async def list_imwm_aging(
    request: Request,
    plant: Optional[str] = None,
    user: UserIdentity = Depends(require_proxy_user),
):
    """Return inventory aging buckets for the IMWM Analytics tab."""
    token = user.raw_token
    check_warehouse_config()
    rows = await inventory_queries.list_imwm_aging(token, plant_id=plant)
    return await attach_data_freshness(
        {"aging": rows},
        token,
        _AGING_FRESHNESS_SOURCES,
        request_path=str(request.url.path),
    )
