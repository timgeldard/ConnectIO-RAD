from fastapi import APIRouter, Depends, Header, Request

from backend.manufacturing_analytics.application import queries as analytics_queries
from backend.db import check_warehouse_config
from backend.schemas.order_schemas import AnalyticsRequest
from shared_auth import UserIdentity, require_proxy_user

router = APIRouter()


@router.post("/adherence")
async def fetch_adherence(
    request: Request,
    body: AnalyticsRequest,
    user: UserIdentity = Depends(require_proxy_user),
):
    """
    Return schedule adherence analytics: OTIF rate trend and order-level variance.

    Calculates On-Time In-Full (OTIF) performance by comparing actual 101 receipt
    timestamps against the original scheduled start/end windows from the
    production plan.

    Args:
        request: The incoming FastAPI request object.
        body: Analytic parameters including date range (ISO YYYY-MM-DD) and plant.
        user: Authenticated user identity from the shared auth dependency.

    Returns:
        A dictionary containing the OTIF trend series and a list of order-level 
        variance records with planned vs actual timings.

    Raises:
        HTTPException: 401 if unauthorized, 503 if the SQL warehouse is unreachable, 
                       or 500 for internal server errors.
    """
    token = user.raw_token
    check_warehouse_config()
    return await analytics_queries.get_adherence_analytics(
        token,
        plant_id=body.plant_id,
        date_from=body.date_from,
        date_to=body.date_to,
        request_path=request.url.path,
    )
