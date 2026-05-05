"""
Router for lineage analysis context.
"""

from fastapi import APIRouter, Depends, HTTPException, Request

from shared_trace.domain.models import BatchIdentity
from backend.lineage_analysis.application.queries import (
    get_bottom_up,
    get_recall_readiness,
    get_supplier_risk,
    get_top_down,
)
from backend.lineage_analysis.schemas import (
    BatchPageRequest,
    RecallReadinessRequest,
)
from backend.utils.db import check_warehouse_config
from backend.utils.exceptions import TraceNotFound
from backend.utils.rate_limit import limiter
from shared_auth import UserIdentity, require_proxy_user
from backend.utils.db import handle_sql_error

router = APIRouter()


@router.post("/recall-readiness")
@limiter.limit("30/minute")
async def recall_readiness(
    request: Request,
    body: RecallReadinessRequest,
    user: UserIdentity = Depends(require_proxy_user),
):
    check_warehouse_config()
    identity = BatchIdentity.from_strings(body.material_id, body.batch_id)
    try:
        return await get_recall_readiness(user.raw_token, identity, request.url.path)
    except TraceNotFound as exc:
        raise HTTPException(status_code=404, detail=exc.message)
    except HTTPException:
        raise
    except Exception as exc:
        handle_sql_error(exc)


@router.post("/bottom-up")
@limiter.limit("30/minute")
async def bottom_up(
    request: Request,
    body: BatchPageRequest,
    user: UserIdentity = Depends(require_proxy_user),
):
    check_warehouse_config()
    identity = BatchIdentity.from_strings(body.material_id, body.batch_id)
    try:
        return await get_bottom_up(user.raw_token, identity, request.url.path)
    except TraceNotFound as exc:
        raise HTTPException(status_code=404, detail=exc.message)
    except HTTPException:
        raise
    except Exception as exc:
        handle_sql_error(exc)


@router.post("/top-down")
@limiter.limit("30/minute")
async def top_down(
    request: Request,
    body: BatchPageRequest,
    user: UserIdentity = Depends(require_proxy_user),
):
    check_warehouse_config()
    identity = BatchIdentity.from_strings(body.material_id, body.batch_id)
    try:
        return await get_top_down(user.raw_token, identity, request.url.path)
    except TraceNotFound as exc:
        raise HTTPException(status_code=404, detail=exc.message)
    except HTTPException:
        raise
    except Exception as exc:
        handle_sql_error(exc)


@router.post("/supplier-risk")
@limiter.limit("30/minute")
async def supplier_risk(
    request: Request,
    body: BatchPageRequest,
    user: UserIdentity = Depends(require_proxy_user),
):
    check_warehouse_config()
    identity = BatchIdentity.from_strings(body.material_id, body.batch_id)
    try:
        return await get_supplier_risk(user.raw_token, identity, request.url.path)
    except TraceNotFound as exc:
        raise HTTPException(status_code=404, detail=exc.message)
    except HTTPException:
        raise
    except Exception as exc:
        handle_sql_error(exc)
