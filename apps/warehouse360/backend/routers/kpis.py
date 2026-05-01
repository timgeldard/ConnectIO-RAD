"""Router - warehouse KPIs."""

from typing import Optional

from fastapi import APIRouter, Depends, Header, Request

from backend.dal.kpis import fetch_kpis
from backend.utils.db import attach_data_freshness, check_warehouse_config
from shared_auth import UserIdentity, require_proxy_user

router = APIRouter()

_FRESHNESS_SOURCES = [
    "wh360_process_orders_v",
    "wh360_deliveries_v",
    "wh360_inbound_v",
    "wh360_dispensary_tasks_v",
]


@router.get("/kpis")
async def get_kpis(
    request: Request,
    plant_id: Optional[str] = None,
    user: UserIdentity = Depends(require_proxy_user),
):
    """
    Retrieve high-level warehouse performance metrics.

    Aggregates open process orders, pending deliveries, inbound material status,
    and dispensary task counts for the specified plant or the whole portfolio.

    Args:
        request: The incoming FastAPI request object.
        plant_id: Optional SAP plant code filter.
        user: Authenticated user identity from the shared auth dependency.

    Returns:
        A dictionary containing aggregated KPI values and freshness metadata.

    Raises:
        HTTPException: 401 if unauthorized, 503 if the SQL warehouse is unreachable,
                       or 500 for internal server errors.
    """
    token = user.raw_token
    check_warehouse_config()
    rows = await fetch_kpis(token, plant_id)
    return await attach_data_freshness(
        {"kpis": rows},
        token,
        _FRESHNESS_SOURCES,
        request_path=str(request.url.path),
    )
