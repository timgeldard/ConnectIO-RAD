"""Router — warehouse KPI snapshot."""

from typing import Optional

from fastapi import APIRouter, Header, Request

from backend.dal.kpis import fetch_kpi_snapshot
from backend.utils.db import attach_data_freshness, check_warehouse_config, resolve_token

router = APIRouter()

_FRESHNESS_SOURCES = ["wh360_kpi_snapshot_v"]


@router.get("/kpis")
async def get_kpis(
    request: Request,
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    token = resolve_token(x_forwarded_access_token, authorization)
    check_warehouse_config()
    snapshot = await fetch_kpi_snapshot(token)
    return await attach_data_freshness(
        {"kpis": snapshot},
        token,
        _FRESHNESS_SOURCES,
        request_path=str(request.url.path),
    )
