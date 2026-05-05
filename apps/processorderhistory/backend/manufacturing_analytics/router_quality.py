"""Quality analytics router — POST /api/quality/analytics."""
from typing import Optional

from shared_auth import UserIdentity, require_proxy_user
from fastapi import Depends, APIRouter
from pydantic import BaseModel

from backend.manufacturing_analytics.application import queries as analytics_queries
from backend.db import check_warehouse_config, validate_timezone

router = APIRouter()


class QualityAnalyticsRequest(BaseModel):
    """Request body for the quality analytics endpoint."""

    plant_id: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    timezone: Optional[str] = None


@router.post("/quality/analytics")
async def get_quality_analytics(body: QualityAnalyticsRequest,
    user: UserIdentity = Depends(require_proxy_user)
):
    """Return quality analytics: 30-day daily series, 24h hourly series, and inspection
    result rows for the requested date range.

    Results are inspection characteristic results joined to usage decision records.
    Timestamp is USAGE_DECISION_CREATED_DATE — rows without a decision are excluded
    from date-filtered queries.  ``date_from`` / ``date_to`` are ISO date strings
    (YYYY-MM-DD); omitting both returns the last-24h rolling window.
    Judgement: values starting with 'A' are accepted, all others are rejected.
    """
    token = user.raw_token
    check_warehouse_config()
    return await analytics_queries.get_quality_analytics(
        token,
        plant_id=body.plant_id,
        date_from=body.date_from,
        date_to=body.date_to,
        timezone=validate_timezone(body.timezone),
    )
