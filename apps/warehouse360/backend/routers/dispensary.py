"""Router — dispensary weighing tasks."""

from typing import Optional

from fastapi import APIRouter, Header, Request

from backend.dal.dispensary import fetch_dispensary_tasks
from backend.utils.db import attach_data_freshness, check_warehouse_config, resolve_token

router = APIRouter()

_FRESHNESS_SOURCES = ["wh360_dispensary_tasks_v"]


@router.get("/dispensary")
async def list_dispensary_tasks(
    request: Request,
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    token = resolve_token(x_forwarded_access_token, authorization)
    check_warehouse_config()
    rows = await fetch_dispensary_tasks(token)
    return await attach_data_freshness(
        {"tasks": rows},
        token,
        _FRESHNESS_SOURCES,
        request_path=str(request.url.path),
    )
