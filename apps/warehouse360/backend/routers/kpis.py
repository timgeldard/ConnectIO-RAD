"""Router — warehouse KPI snapshot."""

from typing import Optional

from shared_auth import UserIdentity, require_user
from fastapi import Depends, APIRouter, Header, Request

from backend.dal.kpis import fetch_kpi_snapshot
from backend.utils.db import attach_data_freshness, check_warehouse_config

router = APIRouter()

_FRESHNESS_SOURCES = ["wh360_kpi_snapshot_v"]


@router.get("/kpis")
async def get_kpis(request: Request,
    plant_id: Optional[str] = None,
    user: UserIdentity = Depends(require_user)
):
    token = user.raw_token
    check_warehouse_config()
    snapshot = await fetch_kpi_snapshot(token, plant_id=plant_id)
    return await attach_data_freshness(
        {"kpis": snapshot},
        token,
        _FRESHNESS_SOURCES,
        request_path=str(request.url.path),
    )
