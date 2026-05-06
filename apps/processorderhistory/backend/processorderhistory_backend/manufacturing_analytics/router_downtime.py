from fastapi import APIRouter, Depends

from processorderhistory_backend.manufacturing_analytics.application import queries as analytics_queries
from processorderhistory_backend.db import check_warehouse_config
from processorderhistory_backend.schemas.order_schemas import AnalyticsRequest
from processorderhistory_backend.utils.rate_limit import limiter
from shared_auth import UserIdentity, require_proxy_user

router = APIRouter()


@router.post("/downtime")
@limiter.limit("60/minute")
async def fetch_downtime(
    body: AnalyticsRequest,
    user: UserIdentity = Depends(require_proxy_user),
):
    """
    Return downtime analytics: pareto by reason and daily trend series.

    Aggregates unplanned downtime events by reason category and code, 
    providing both a cumulative pareto distribution and a 30-day time series
    for trend analysis.

    Args:
        request: The incoming FastAPI request object.
        body: Analytic parameters including date range (ISO YYYY-MM-DD) and plant.
        user: Authenticated user identity from the shared auth dependency.

    Returns:
        A dictionary containing the reason pareto data, total downtime minutes, 
        and the daily trend series.

    Raises:
        HTTPException: 401 if unauthorized, 503 if the SQL warehouse is unreachable, 
                       or 500 for internal server errors.
    """
    token = user.raw_token
    check_warehouse_config()
    return await analytics_queries.get_downtime_analytics(
        token,
        plant_id=body.plant_id,
        date_from=body.date_from,
        date_to=body.date_to,
        timezone=body.timezone or "UTC",
    )
