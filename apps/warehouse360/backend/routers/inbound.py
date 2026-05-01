"""Router — inbound receipts."""

from typing import Optional

from shared_auth import UserIdentity, require_user
from fastapi import Depends, APIRouter, Header, HTTPException, Request

from backend.dal.inbound import fetch_inbound, fetch_receipt_detail
from backend.utils.db import attach_data_freshness, check_warehouse_config

router = APIRouter()

_LIST_FRESHNESS_SOURCES = ["wh360_inbound_v"]
_DETAIL_FRESHNESS_SOURCES = [
    "wh360_inbound_v",
]


@router.get("/inbound")
async def list_inbound(request: Request,
    plant_id: Optional[str] = None,
    user: UserIdentity = Depends(require_user)
):
    token = user.raw_token
    check_warehouse_config()
    rows = await fetch_inbound(token, plant_id=plant_id)
    return await attach_data_freshness(
        {"receipts": rows},
        token,
        _LIST_FRESHNESS_SOURCES,
        request_path=str(request.url.path),
    )


@router.get("/inbound/{po_id}")
async def get_receipt(po_id: str,
    request: Request,
    user: UserIdentity = Depends(require_user)
):
    token = user.raw_token
    check_warehouse_config()
    detail = await fetch_receipt_detail(token, po_id)
    if detail.get("receipt") is None:
        raise HTTPException(status_code=404, detail=f"Inbound receipt '{po_id}' not found.")
    return await attach_data_freshness(
        {"receipt": detail},
        token,
        _DETAIL_FRESHNESS_SOURCES,
        request_path=str(request.url.path),
    )
