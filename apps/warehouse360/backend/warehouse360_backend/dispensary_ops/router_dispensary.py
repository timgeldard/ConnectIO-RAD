"""Router — dispensary weighing tasks."""

from typing import Optional

from shared_auth import UserIdentity, require_proxy_user
from fastapi import Depends, APIRouter, Request

from warehouse360_backend.dispensary_ops.application import queries as dispensary_queries
from warehouse360_backend.utils.db import attach_data_freshness, check_warehouse_config
from warehouse360_backend.utils.rate_limit import limiter

router = APIRouter()

_FRESHNESS_SOURCES = ["wh360_dispensary_tasks_v"]


@router.get("/dispensary")
@limiter.limit("60/minute")
async def list_dispensary_tasks(request: Request,
    plant_id: Optional[str] = None,
    user: UserIdentity = Depends(require_proxy_user)
):
    token = user.raw_token
    check_warehouse_config()
    rows = await dispensary_queries.list_dispensary_tasks(token, plant_id=plant_id)
    return await attach_data_freshness(
        {"tasks": rows},
        token,
        _FRESHNESS_SOURCES,
        request_path=str(request.url.path),
    )
