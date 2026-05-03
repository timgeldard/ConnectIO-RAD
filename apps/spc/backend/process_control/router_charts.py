"""Process Control — chart data, control limits, and data quality endpoints."""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import ValidationError

from backend.process_control.dal.charts import (
    decode_chart_cursor,
    fetch_chart_data_page,
    fetch_control_limits,
    fetch_count_chart_data,
    fetch_data_quality_summary,
    fetch_normality_summary,
    fetch_p_chart_data,
    fetch_spec_drift_summary,
)
from shared_db.utils import handle_sql_error
from backend.schemas.spc_schemas import (
    ChartDataRequest,
    ControlLimitsRequest,
    CountChartDataRequest,
    DataQualityRequest,
    PChartDataRequest,
)
from backend.utils.db import attach_data_freshness, check_warehouse_config
from backend.utils.rate_limit import limiter
from shared_auth import UserIdentity, require_proxy_user

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/chart-data")
@limiter.limit("60/minute")
async def spc_chart_data(
    request: Request,
    body: ChartDataRequest,
    user: UserIdentity = Depends(require_proxy_user),
    cursor: Optional[str] = Query(default=None),
    limit: int = Query(default=1000, ge=1, le=5000),
    include_summary: bool = Query(default=False),
):
    """
    Retrieve a paginated set of observation points for SPC charting.

    Supports cursor-based pagination to handle large datasets without overloading
    the Databricks SQL Warehouse. Optionally includes normality and spec drift
    summaries for the selected cohort.
    """
    token = user.raw_token
    check_warehouse_config()
    if cursor is not None:
        try:
            decode_chart_cursor(cursor)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
    try:
        page = await fetch_chart_data_page(
            token,
            body.material_id,
            body.mic_id,
            body.mic_name,
            body.plant_id,
            body.date_from,
            body.date_to,
            body.stratify_by,
            cursor=cursor,
            limit=limit,
            operation_id=body.operation_id,
        )
    except Exception as exc:
        handle_sql_error(exc)
    normality = None
    spec_drift = None
    if include_summary and cursor is None:
        try:
            normality = await fetch_normality_summary(
                token,
                body.material_id,
                body.mic_id,
                body.plant_id,
                body.date_from,
                body.date_to,
                operation_id=body.operation_id,
            )
        except Exception as exc:
            handle_sql_error(exc)
        try:
            drift_raw = await fetch_spec_drift_summary(
                token,
                body.material_id,
                body.mic_id,
                body.plant_id,
                body.date_from,
                body.date_to,
                body.operation_id,
            )
            if drift_raw["detected"]:
                n = drift_raw["distinct_signatures"]
                b = drift_raw["total_batches"]
                spec_drift = {
                    "detected": True,
                    "distinct_signatures": n,
                    "total_batches": b,
                    "signature_set": drift_raw["signature_set"],
                    "change_references": drift_raw.get("change_references"),
                    "message": (
                        f"Specification limits changed {n} time(s) across {b} batch(es) "
                        "in this date range. Control limits computed over the full range "
                        "may be invalid. Consider narrowing the date range to a single "
                        "spec regime."
                    ),
                }
        except Exception as exc:
            logger.warning(
                "spc.spec_drift_summary_failed material_id=%s mic_id=%s operation_id=%s",
                body.material_id,
                body.mic_id,
                body.operation_id,
                exc_info=exc,
            )

    return await attach_data_freshness(
        {
            "data": page["data"],
            "next_cursor": page["next_cursor"],
            "has_more": page["has_more"],
            "count": len(page["data"]),
            "limit": limit,
            "stratified": body.stratify_by is not None,
            "stratify_by": body.stratify_by,
            "data_truncated": False,
            "normality": normality,
            "spec_drift": spec_drift,
        },
        token,
        ["gold_batch_quality_result_v", "spc_batch_dim_mv"],
        request_path=request.url.path,
    )


@router.post("/data-quality")
@limiter.limit("60/minute")
async def spc_data_quality(
    request: Request,
    body: DataQualityRequest,
    user: UserIdentity = Depends(require_proxy_user),
):
    """Evaluate the quality and consistency of observation data."""
    token = user.raw_token
    check_warehouse_config()
    try:
        summary = await fetch_data_quality_summary(
            token,
            body.material_id,
            body.mic_id,
            body.plant_id,
            body.date_from,
            body.date_to,
            operation_id=body.operation_id,
        )
    except Exception as exc:
        handle_sql_error(exc)

    return await attach_data_freshness(
        summary,
        token,
        ["gold_batch_quality_result_v", "gold_batch_mass_balance_v"],
        request_path=request.url.path,
    )


@router.post("/control-limits")
@limiter.limit("60/minute")
async def spc_control_limits(
    request: Request,
    body: ControlLimitsRequest,
    user: UserIdentity = Depends(require_proxy_user),
):
    """Retrieve calculated control limits for a specific cohort."""
    token = user.raw_token
    check_warehouse_config()
    try:
        limits = await fetch_control_limits(
            token,
            body.material_id,
            body.mic_id,
            body.plant_id,
            body.date_from,
            body.date_to,
            operation_id=body.operation_id,
        )
    except Exception as exc:
        handle_sql_error(exc)

    return await attach_data_freshness(
        {"control_limits": limits},
        token,
        ["spc_quality_metrics"],
        request_path=request.url.path,
    )


@router.post("/p-chart-data")
@limiter.limit("60/minute")
async def spc_p_chart_data(
    request: Request,
    body: PChartDataRequest,
    user: UserIdentity = Depends(require_proxy_user),
):
    """Retrieve data specifically aggregated for P-Charts (Proportion Defective)."""
    token = user.raw_token
    check_warehouse_config()
    try:
        rows = await fetch_p_chart_data(
            token,
            body.material_id,
            body.mic_id,
            body.mic_name,
            body.plant_id,
            body.date_from,
            body.date_to,
            operation_id=body.operation_id,
        )
    except Exception as exc:
        handle_sql_error(exc)

    return await attach_data_freshness(
        {"points": rows, "count": len(rows)},
        token,
        ["spc_attribute_subgroup_mv"],
        request_path=request.url.path,
    )


@router.post("/count-chart-data")
@limiter.limit("60/minute")
async def spc_count_chart_data(
    request: Request,
    body: CountChartDataRequest,
    user: UserIdentity = Depends(require_proxy_user),
):
    """Retrieve data specifically aggregated for C-Charts or U-Charts (Count of Defects)."""
    token = user.raw_token
    check_warehouse_config()
    try:
        rows = await fetch_count_chart_data(
            token,
            body.material_id,
            body.mic_id,
            body.mic_name,
            body.plant_id,
            body.date_from,
            body.date_to,
            body.chart_subtype,
            operation_id=body.operation_id,
        )
    except Exception as exc:
        handle_sql_error(exc)

    return await attach_data_freshness(
        {"points": rows, "count": len(rows), "chart_subtype": body.chart_subtype},
        token,
        ["spc_attribute_subgroup_mv"],
        request_path=request.url.path,
    )
