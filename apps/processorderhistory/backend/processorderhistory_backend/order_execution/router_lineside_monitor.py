"""Lineside Monitor router — POST /api/lineside-monitor/summary."""
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from shared_auth import UserIdentity, require_proxy_user

from processorderhistory_backend.db import check_warehouse_config
from processorderhistory_backend.order_execution.application import queries as order_queries
from processorderhistory_backend.utils.rate_limit import limiter

router = APIRouter()


class LinesideMonitorRequest(BaseModel):
    plant_id: Optional[str] = None


@router.post("/lineside-monitor/summary")
@limiter.limit("60/minute")
async def get_lineside_monitor_summary(
    body: LinesideMonitorRequest,
    user: UserIdentity = Depends(require_proxy_user),
) -> dict:
    """Return live line, order, downtime, and line-side stock state for wallboards."""
    token = user.raw_token
    check_warehouse_config()
    return await order_queries.get_lineside_monitor(token, plant_id=body.plant_id)
