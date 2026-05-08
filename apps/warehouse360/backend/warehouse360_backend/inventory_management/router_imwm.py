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


def _resolve_plant_scope(plant: Optional[str], plant_id: Optional[str]) -> Optional[str]:
    """Resolve the plant identifier from the two accepted query parameters.

    Both ``plant`` (the original IMWM-tab parameter) and ``plant_id`` (the
    Warehouse360 cross-app plant context) are accepted on every IMWM
    endpoint. ``plant`` wins when both are present so a deliberate
    cockpit selection takes precedence over inherited context. Whitespace-
    only strings are normalised to empty so a stray space in the URL
    doesn't bypass the fallback.

    Args:
        plant: The original IMWM query parameter.
        plant_id: The Warehouse360 plant context parameter.

    Returns:
        The resolved plant identifier (already stripped), or ``None`` when
        neither parameter carries a meaningful value — in which case the
        caller queries across all plants visible to the token.
    """
    primary = (plant or "").strip()
    if primary:
        return primary
    secondary = (plant_id or "").strip()
    return secondary or None


@router.get("/imwm/stock")
@limiter.limit("60/minute")
async def list_imwm_stock(
    request: Request,
    plant: Optional[str] = None,
    plant_id: Optional[str] = None,
    user: UserIdentity = Depends(require_proxy_user),
):
    """Return IM vs WM stock comparison rows for the IMWM Reconciliation tab.

    Args:
        request: FastAPI request, used to attach the request path to the
            data-freshness metadata for log correlation.
        plant: Optional IMWM-tab plant filter. Takes precedence over
            ``plant_id`` when both are provided.
        plant_id: Optional Warehouse360 cross-app plant context (e.g.
            forwarded via ``parseCrossAppContext``). Used as a fallback
            when ``plant`` is empty so navigations from another W360
            module land scoped to the same plant.
        user: Proxy-validated identity, injected by FastAPI.

    Returns:
        Object with ``stock`` (list of comparison rows) and
        ``data_freshness`` metadata for the upstream
        ``imwm_stock_comparison_v`` view.
    """
    token = user.raw_token
    check_warehouse_config()
    rows = await inventory_queries.list_imwm_stock(token, plant_id=_resolve_plant_scope(plant, plant_id))
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
    plant_id: Optional[str] = None,
    user: UserIdentity = Depends(require_proxy_user),
):
    """Return recent goods movements for the IMWM Overview activity strip.

    Args:
        request: FastAPI request (used for freshness logging).
        plant: Optional IMWM-tab plant filter. Takes precedence over
            ``plant_id`` when both are provided.
        plant_id: Optional Warehouse360 cross-app plant context, used
            as a fallback when ``plant`` is empty.
        user: Proxy-validated identity, injected by FastAPI.

    Returns:
        Object with ``movements`` (most-recent rows, capped at 200 in the
        DAL) and ``data_freshness`` metadata for ``imwm_movements_v``.
    """
    token = user.raw_token
    check_warehouse_config()
    rows = await inventory_queries.list_imwm_movements(token, plant_id=_resolve_plant_scope(plant, plant_id))
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
    plant_id: Optional[str] = None,
    user: UserIdentity = Depends(require_proxy_user),
):
    """Return the rule-generated IMWM exception queue for the operations cockpit.

    Args:
        request: FastAPI request (used for freshness logging).
        plant: Optional IMWM-tab plant filter. Takes precedence over
            ``plant_id`` when both are provided.
        plant_id: Optional Warehouse360 cross-app plant context, used
            as a fallback when ``plant`` is empty.
        user: Proxy-validated identity, injected by FastAPI.

    Returns:
        Object with ``exceptions`` (rows ordered severity-DESC) and
        ``data_freshness`` metadata for ``imwm_exceptions_v``.
    """
    token = user.raw_token
    check_warehouse_config()
    rows = await inventory_queries.list_imwm_exceptions(token, plant_id=_resolve_plant_scope(plant, plant_id))
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
    plant_id: Optional[str] = None,
    user: UserIdentity = Depends(require_proxy_user),
):
    """Return inventory aging buckets for the IMWM Analytics tab.

    Args:
        request: FastAPI request (used for freshness logging).
        plant: Optional IMWM-tab plant filter. Takes precedence over
            ``plant_id`` when both are provided.
        plant_id: Optional Warehouse360 cross-app plant context, used
            as a fallback when ``plant`` is empty.
        user: Proxy-validated identity, injected by FastAPI.

    Returns:
        Object with ``aging`` (one row per plant × age bucket) and
        ``data_freshness`` metadata for ``imwm_analytics_aging_v``.
    """
    token = user.raw_token
    check_warehouse_config()
    rows = await inventory_queries.list_imwm_aging(token, plant_id=_resolve_plant_scope(plant, plant_id))
    return await attach_data_freshness(
        {"aging": rows},
        token,
        _AGING_FRESHNESS_SOURCES,
        request_path=str(request.url.path),
    )
