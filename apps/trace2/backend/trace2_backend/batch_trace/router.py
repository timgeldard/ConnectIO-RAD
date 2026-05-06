"""
Router for batch trace context.
"""

from fastapi import APIRouter, Depends, HTTPException, Request

from trace2_backend.batch_trace.application.queries import (
    get_batch_details,
    get_batch_header,
    get_impact,
    get_summary,
    get_trace_tree,
)
from shared_trace.domain.models import BatchIdentity, BatchOnlyIdentity
from trace2_backend.batch_trace.schemas import (
    BatchDetailsRequest,
    BatchPageRequest,
    ImpactRequest,
    SummaryRequest,
    TraceRequest,
)
from trace2_backend.utils.db import check_warehouse_config
from trace2_backend.utils.exceptions import TraceNotFound
from trace2_backend.utils.rate_limit import limiter
from shared_auth import UserIdentity, require_proxy_user
from trace2_backend.utils.db import handle_sql_error

router = APIRouter()


@router.post("/trace")
@limiter.limit("30/minute")
async def trace(
    request: Request,
    body: TraceRequest,
    user: UserIdentity = Depends(require_proxy_user),
):
    """
    Generate a full material lineage tree (Upstream + Downstream).
    """
    check_warehouse_config()
    identity = BatchIdentity.from_strings(body.material_id, body.batch_id)
    try:
        return await get_trace_tree(user.raw_token, identity, request.url.path)
    except TraceNotFound as exc:
        raise HTTPException(status_code=404, detail=exc.message)
    except HTTPException:
        raise
    except Exception as exc:
        handle_sql_error(exc)


@router.post("/summary")
@limiter.limit("60/minute")
async def summary(
    request: Request,
    body: SummaryRequest,
    user: UserIdentity = Depends(require_proxy_user),
):
    """
    Get a high-level inventory and mass-balance summary for a batch.
    """
    check_warehouse_config()
    identity = BatchOnlyIdentity.from_string(body.batch_id)
    try:
        return await get_summary(user.raw_token, identity, request.url.path)
    except TraceNotFound as exc:
        raise HTTPException(status_code=404, detail=exc.message)
    except HTTPException:
        raise
    except Exception as exc:
        handle_sql_error(exc)


@router.post("/batch-details")
@limiter.limit("30/minute")
async def batch_details(
    request: Request,
    body: BatchDetailsRequest,
    user: UserIdentity = Depends(require_proxy_user),
):
    check_warehouse_config()
    identity = BatchIdentity.from_strings(body.material_id, body.batch_id)
    try:
        return await get_batch_details(user.raw_token, identity, request.url.path)
    except TraceNotFound as exc:
        raise HTTPException(status_code=404, detail=exc.message)
    except HTTPException:
        raise
    except Exception as exc:
        handle_sql_error(exc)


@router.post("/impact")
@limiter.limit("60/minute")
async def impact(
    request: Request,
    body: ImpactRequest,
    user: UserIdentity = Depends(require_proxy_user),
):
    check_warehouse_config()
    identity = BatchOnlyIdentity.from_string(body.batch_id)
    try:
        return await get_impact(user.raw_token, identity, request.url.path)
    except HTTPException:
        raise
    except Exception as exc:
        handle_sql_error(exc)


@router.post("/batch-header")
@limiter.limit("60/minute")
async def batch_header(
    request: Request,
    body: BatchPageRequest,
    user: UserIdentity = Depends(require_proxy_user),
):
    check_warehouse_config()
    identity = BatchIdentity.from_strings(body.material_id, body.batch_id)
    try:
        return await get_batch_header(user.raw_token, identity)
    except TraceNotFound as exc:
        raise HTTPException(status_code=404, detail=exc.message)
    except HTTPException:
        raise
    except Exception as exc:
        handle_sql_error(exc)
