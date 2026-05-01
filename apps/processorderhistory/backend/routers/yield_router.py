from fastapi import APIRouter, Depends, Header, Request

from backend.dal.yield_analytics_dal import fetch_yield_analytics
from backend.db import check_warehouse_config
from backend.schemas.order_schemas import AnalyticsRequest
from shared_auth import UserIdentity, require_proxy_user

router = APIRouter()


@router.post("/yield")
async def fetch_yield(
    request: Request,
    body: AnalyticsRequest,
    user: UserIdentity = Depends(require_proxy_user),
):
    """
    Return yield analytics: per-order yield, 30-day daily series, 24h hourly series.

    Yield is defined as the Right-First-Time ratio of production output.
    Formula: Yield = (MT-101 received kg / MT-261 issued kg) * 100.

    Args:
        request: The incoming FastAPI request object.
        body: Analytic parameters including date range (ISO YYYY-MM-DD) and plant.
        user: Authenticated user identity from the shared auth dependency.

    Returns:
        A dictionary containing per-order yield metrics, a 30-day daily trend series,
        and a 24-hour hourly trend series.

    Raises:
        HTTPException: 401 if unauthorized, 503 if the SQL warehouse is unreachable, 
                       or 500 for internal server errors.
    """
    token = user.raw_token
    check_warehouse_config()
    return await fetch_yield_analytics(
        token,
        plant_id=body.plant_id,
        date_from=body.date_from,
        date_to=body.date_to,
        request_path=request.url.path,
    )
