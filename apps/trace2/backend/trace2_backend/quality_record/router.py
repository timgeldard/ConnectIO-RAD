"""
Router for quality record context.
"""

from fastapi import APIRouter, Depends, HTTPException, Request

from shared_trace.domain.models import BatchIdentity
from trace2_backend.quality_record.application.queries import (
    get_batch_compare,
    get_coa,
    get_mass_balance,
    get_production_history,
    get_quality,
)
from trace2_backend.quality_record.schemas import (
    BatchPageRequest,
)
from trace2_backend.utils.db import check_warehouse_config
from trace2_backend.utils.exceptions import TraceNotFound
from trace2_backend.utils.rate_limit import limiter
from shared_auth import UserIdentity, require_proxy_user
from trace2_backend.utils.db import handle_sql_error

router = APIRouter()


@router.post("/coa")
@limiter.limit("30/minute")
async def coa(
    request: Request,
    body: BatchPageRequest,
    user: UserIdentity = Depends(require_proxy_user),
):
    check_warehouse_config()
    identity = BatchIdentity.from_strings(body.material_id, body.batch_id)
    try:
        return await get_coa(user.raw_token, identity, request.url.path)
    except TraceNotFound as exc:
        raise HTTPException(status_code=404, detail=exc.message)
    except HTTPException:
        raise
    except Exception as exc:
        handle_sql_error(exc)


@router.post("/mass-balance")
@limiter.limit("30/minute")
async def mass_balance(
    request: Request,
    body: BatchPageRequest,
    user: UserIdentity = Depends(require_proxy_user),
):
    check_warehouse_config()
    identity = BatchIdentity.from_strings(body.material_id, body.batch_id)
    try:
        return await get_mass_balance(user.raw_token, identity, request.url.path)
    except TraceNotFound as exc:
        raise HTTPException(status_code=404, detail=exc.message)
    except HTTPException:
        raise
    except Exception as exc:
        handle_sql_error(exc)


@router.post("/quality")
@limiter.limit("30/minute")
async def quality(
    request: Request,
    body: BatchPageRequest,
    user: UserIdentity = Depends(require_proxy_user),
):
    check_warehouse_config()
    identity = BatchIdentity.from_strings(body.material_id, body.batch_id)
    try:
        return await get_quality(user.raw_token, identity, request.url.path)
    except TraceNotFound as exc:
        raise HTTPException(status_code=404, detail=exc.message)
    except HTTPException:
        raise
    except Exception as exc:
        handle_sql_error(exc)


@router.post("/production-history")
@limiter.limit("30/minute")
async def production_history(
    request: Request,
    body: BatchPageRequest,
    user: UserIdentity = Depends(require_proxy_user),
):
    check_warehouse_config()
    identity = BatchIdentity.from_strings(body.material_id, body.batch_id)
    try:
        return await get_production_history(user.raw_token, identity, request.url.path)
    except TraceNotFound as exc:
        raise HTTPException(status_code=404, detail=exc.message)
    except HTTPException:
        raise
    except Exception as exc:
        handle_sql_error(exc)


@router.post("/batch-compare")
@limiter.limit("30/minute")
async def batch_compare(
    request: Request,
    body: BatchPageRequest,
    user: UserIdentity = Depends(require_proxy_user),
):
    check_warehouse_config()
    identity = BatchIdentity.from_strings(body.material_id, body.batch_id)
    try:
        return await get_batch_compare(user.raw_token, identity, request.url.path)
    except TraceNotFound as exc:
        raise HTTPException(status_code=404, detail=exc.message)
    except HTTPException:
        raise
    except Exception as exc:
        handle_sql_error(exc)
