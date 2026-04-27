"""Router — inbound receipts."""

from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Request

from backend.dal.inbound import fetch_inbound, fetch_receipt_detail
from backend.utils.db import attach_data_freshness, check_warehouse_config, resolve_token

router = APIRouter()

_LIST_FRESHNESS_SOURCES = ["wh360_inbound_v"]
_DETAIL_FRESHNESS_SOURCES = [
    "wh360_inbound_v",
]


@router.get("/inbound")
async def list_inbound(
    request: Request,
    plant_id: Optional[str] = None,
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    token = resolve_token(x_forwarded_access_token, authorization)
    check_warehouse_config()
    rows = await fetch_inbound(token, plant_id=plant_id)
    return await attach_data_freshness(
        {"receipts": rows},
        token,
        _LIST_FRESHNESS_SOURCES,
        request_path=str(request.url.path),
    )


@router.get("/inbound/{po_id}")
async def get_receipt(
    po_id: str,
    request: Request,
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    token = resolve_token(x_forwarded_access_token, authorization)
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
