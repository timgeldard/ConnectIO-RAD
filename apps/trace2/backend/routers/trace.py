from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request

from shared_trace.freshness_sources import (
    BATCH_DETAILS_FRESHNESS_SOURCES,
    IMPACT_FRESHNESS_SOURCES,
    SUMMARY_FRESHNESS_SOURCES,
    TRACE2_PAGE_FRESHNESS_SOURCES,
    TRACE_TREE_FRESHNESS_SOURCES,
)

from backend.dal.trace_dal import (
    MAX_TRACE_LEVELS,
    _build_tree,
    fetch_batch_compare,
    fetch_batch_details,
    fetch_batch_header,
    fetch_bottom_up,
    fetch_coa,
    fetch_impact,
    fetch_mass_balance,
    fetch_production_history,
    fetch_quality,
    fetch_recall_readiness,
    fetch_summary,
    fetch_supplier_risk,
    fetch_top_down,
    fetch_trace_tree,
)
from shared_db.utils import attach_payload_freshness, handle_sql_error
from backend.schemas.trace_schemas import (
    BatchDetailsRequest,
    BatchPageRequest,
    ImpactRequest,
    RecallReadinessRequest,
    SummaryRequest,
    TraceRequest,
)
from backend.utils.db import attach_data_freshness, check_warehouse_config
from backend.utils.rate_limit import limiter
from shared_auth import UserIdentity, require_proxy_user

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
    
    Traverses the supply chain using recursive CTEs to identify all 
    relationships for the suspect material/batch.
    """
    token = user.raw_token
    check_warehouse_config()
    try:
        rows = await fetch_trace_tree(token, body.material_id, body.batch_id, MAX_TRACE_LEVELS)
    except Exception as exc:
        handle_sql_error(exc)

    if not rows:
        raise HTTPException(
            status_code=404,
            detail=f"No traceability data found for Material '{body.material_id}', Batch '{body.batch_id}'.",
        )

    return await attach_payload_freshness(
        {"tree": _build_tree(rows), "total_nodes": len(rows)},
        token,
        request.url.path,
        list(TRACE_TREE_FRESHNESS_SOURCES),
        attach_freshness_func=attach_data_freshness
    )


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
    token = user.raw_token
    check_warehouse_config()
    try:
        payload = await fetch_summary(token, body.batch_id)
    except Exception as exc:
        handle_sql_error(exc)

    if not payload:
        raise HTTPException(status_code=404, detail=f"No summary data for Batch '{body.batch_id}'.")

    return await attach_payload_freshness(
        payload,
        token,
        request.url.path,
        list(SUMMARY_FRESHNESS_SOURCES),
        attach_freshness_func=attach_data_freshness
    )


@router.post("/batch-details")
@limiter.limit("30/minute")
async def batch_details(
    request: Request,
    body: BatchDetailsRequest,
    user: UserIdentity = Depends(require_proxy_user),
):
    token = user.raw_token
    check_warehouse_config()
    try:
        payload = await fetch_batch_details(token, body.material_id, body.batch_id)
    except Exception as exc:
        handle_sql_error(exc)

    if not payload.get("summary"):
        raise HTTPException(status_code=404, detail=f"No data for Batch '{body.batch_id}'.")

    return await attach_payload_freshness(
        payload,
        token,
        request.url.path,
        list(BATCH_DETAILS_FRESHNESS_SOURCES),
        attach_freshness_func=attach_data_freshness
    )


@router.post("/impact")
@limiter.limit("60/minute")
async def impact(
    request: Request,
    body: ImpactRequest,
    user: UserIdentity = Depends(require_proxy_user),
):
    token = user.raw_token
    check_warehouse_config()
    try:
        payload = await fetch_impact(token, body.batch_id)
    except Exception as exc:
        handle_sql_error(exc)

    return await attach_payload_freshness(
        payload,
        token,
        request.url.path,
        list(IMPACT_FRESHNESS_SOURCES),
        attach_freshness_func=attach_data_freshness
    )


@router.post("/batch-header")
@limiter.limit("60/minute")
async def batch_header(
    request: Request,
    body: BatchPageRequest,
    user: UserIdentity = Depends(require_proxy_user),
):
    token = user.raw_token
    check_warehouse_config()
    try:
        row = await fetch_batch_header(token, body.material_id, body.batch_id)
    except Exception as exc:
        handle_sql_error(exc)

    if not row:
        raise HTTPException(
            status_code=404,
            detail=f"No data for Material '{body.material_id}', Batch '{body.batch_id}'.",
        )
    return row


@router.post("/recall-readiness")
@limiter.limit("30/minute")
async def recall_readiness(
    request: Request,
    body: RecallReadinessRequest,
    user: UserIdentity = Depends(require_proxy_user),
):
    token = user.raw_token
    check_warehouse_config()
    try:
        payload = await fetch_recall_readiness(token, body.material_id, body.batch_id)
    except Exception as exc:
        handle_sql_error(exc)

    if not payload.get("header"):
        raise HTTPException(
            status_code=404,
            detail=f"No data for Material '{body.material_id}', Batch '{body.batch_id}'.",
        )

    return await attach_payload_freshness(
        payload,
        token,
        request.url.path,
        [
            "gold_batch_lineage",
            "gold_batch_stock_mat",
            "gold_batch_mass_balance_mat",
            "gold_batch_delivery_mat",
            "gold_batch_summary_v",
            "gold_plant",
        ],
        attach_freshness_func=attach_data_freshness
    )


_PAGE_SOURCES = {key: list(value) for key, value in TRACE2_PAGE_FRESHNESS_SOURCES.items()}


async def _batch_page_endpoint(
    request: Request,
    body: BatchPageRequest,
    fetcher,
    page_key: str,
    user: UserIdentity,
):
    token = user.raw_token
    check_warehouse_config()
    try:
        payload = await fetcher(token, body.material_id, body.batch_id)
    except Exception as exc:
        handle_sql_error(exc)

    if not payload.get("header"):
        raise HTTPException(
            status_code=404,
            detail=f"No data for Material '{body.material_id}', Batch '{body.batch_id}'.",
        )

    return await attach_payload_freshness(
        payload,
        token,
        request.url.path,
        _PAGE_SOURCES[page_key],
        attach_freshness_func=attach_data_freshness
    )


@router.post("/coa")
@limiter.limit("30/minute")
async def coa(
    request: Request,
    body: BatchPageRequest,
    user: UserIdentity = Depends(require_proxy_user),
):
    return await _batch_page_endpoint(
        request, body, fetch_coa, "coa", user
    )


@router.post("/mass-balance")
@limiter.limit("30/minute")
async def mass_balance(
    request: Request,
    body: BatchPageRequest,
    user: UserIdentity = Depends(require_proxy_user),
):
    return await _batch_page_endpoint(
        request, body, fetch_mass_balance, "mass_balance", user
    )


@router.post("/quality")
@limiter.limit("30/minute")
async def quality(
    request: Request,
    body: BatchPageRequest,
    user: UserIdentity = Depends(require_proxy_user),
):
    return await _batch_page_endpoint(
        request, body, fetch_quality, "quality", user
    )


@router.post("/production-history")
@limiter.limit("30/minute")
async def production_history(
    request: Request,
    body: BatchPageRequest,
    user: UserIdentity = Depends(require_proxy_user),
):
    return await _batch_page_endpoint(
        request, body, fetch_production_history, "production_history", user
    )


@router.post("/batch-compare")
@limiter.limit("30/minute")
async def batch_compare(
    request: Request,
    body: BatchPageRequest,
    user: UserIdentity = Depends(require_proxy_user),
):
    return await _batch_page_endpoint(
        request, body, fetch_batch_compare, "batch_compare", user
    )


@router.post("/bottom-up")
@limiter.limit("30/minute")
async def bottom_up(
    request: Request,
    body: BatchPageRequest,
    user: UserIdentity = Depends(require_proxy_user),
):
    return await _batch_page_endpoint(
        request, body, fetch_bottom_up, "bottom_up", user
    )


@router.post("/top-down")
@limiter.limit("30/minute")
async def top_down(
    request: Request,
    body: BatchPageRequest,
    user: UserIdentity = Depends(require_proxy_user),
):
    return await _batch_page_endpoint(
        request, body, fetch_top_down, "top_down", user
    )


@router.post("/supplier-risk")
@limiter.limit("30/minute")
async def supplier_risk(
    request: Request,
    body: BatchPageRequest,
    user: UserIdentity = Depends(require_proxy_user),
):
    return await _batch_page_endpoint(
        request, body, fetch_supplier_risk, "supplier_risk", user
    )
