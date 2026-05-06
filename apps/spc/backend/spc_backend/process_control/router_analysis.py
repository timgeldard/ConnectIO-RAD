"""Process Control — process flow, scorecard, MSA, correlation, and multivariate endpoints."""


from fastapi import APIRouter, Depends, Request

from spc_backend.process_control.application.analysis import (
    fetch_compare_scorecard,
    fetch_correlation,
    fetch_correlation_scatter,
    fetch_multivariate,
    fetch_process_flow,
    fetch_scorecard,
    msa_calculate,
    save_msa_session,
)
from spc_backend.utils.db import handle_analysis_error, handle_sql_error
from spc_backend.schemas.spc_schemas import (
    CalculateMSARequest,
    CompareScorecardsRequest,
    CorrelationRequest,
    CorrelationScatterRequest,
    MultivariateRequest,
    ProcessFlowRequest,
    SaveMSARequest,
    ScorecardRequest,
)
from spc_backend.utils.db import attach_data_freshness, check_warehouse_config
from spc_backend.utils.rate_limit import limiter
from shared_auth import UserIdentity, require_proxy_user

router = APIRouter()


@router.post("/process-flow")
@limiter.limit("30/minute")
async def spc_process_flow(
    request: Request,
    body: ProcessFlowRequest,
    user: UserIdentity = Depends(require_proxy_user),
):
    """
    Retrieve material lineage and process flow data for a specific material.

    Returns a graph-compatible structure of upstream inputs and downstream
    outputs, including process health indicators at each node.
    """
    token = user.raw_token
    check_warehouse_config()
    try:
        payload = await fetch_process_flow(
            token,
            body.material_id,
            body.date_from,
            body.date_to,
            body.upstream_depth,
            body.downstream_depth,
        )
    except Exception as exc:
        handle_analysis_error(exc)

    return await attach_data_freshness(
        payload,
        token,
        ["spc_lineage_graph_mv", "spc_process_flow_source_mv"],
        request_path=request.url.path,
    )


@router.post("/scorecard")
@limiter.limit("45/minute")
async def spc_scorecard(
    request: Request,
    body: ScorecardRequest,
    user: UserIdentity = Depends(require_proxy_user),
):
    """Generate a quality scorecard summary for all MICs of a material."""
    token = user.raw_token
    check_warehouse_config()
    try:
        rows = await fetch_scorecard(token, body.material_id, body.plant_id, body.date_from, body.date_to)
    except Exception as exc:
        handle_sql_error(exc)

    return await attach_data_freshness(
        {"scorecard": rows, "material_id": body.material_id},
        token,
        ["spc_quality_metrics"],
        request_path=request.url.path,
    )


@router.post("/compare-scorecard")
@limiter.limit("10/minute")
async def compare_scorecard(
    request: Request,
    body: CompareScorecardsRequest,
    user: UserIdentity = Depends(require_proxy_user),
):
    """Compare quality performance across multiple materials."""
    token = user.raw_token
    check_warehouse_config()
    try:
        return await fetch_compare_scorecard(token, body.material_ids, body.plant_id, body.date_from, body.date_to)
    except Exception as exc:
        handle_sql_error(exc)


@router.post("/msa/save")
@limiter.limit("10/minute")
async def msa_save(
    request: Request,
    body: SaveMSARequest,
    user: UserIdentity = Depends(require_proxy_user),
):
    """Persist a Gauge R&R session result."""
    token = user.raw_token
    check_warehouse_config()
    try:
        return await save_msa_session(
            token,
            body.material_id,
            body.mic_id,
            body.n_operators,
            body.n_parts,
            body.n_replicates,
            body.grr_pct,
            body.repeatability,
            body.reproducibility,
            body.ndc,
            body.results_json,
        )
    except Exception as exc:
        handle_sql_error(exc)


@router.post("/msa/calculate")
@limiter.limit("20/minute")
async def msa_calculate_endpoint(
    body: CalculateMSARequest,
    user: UserIdentity = Depends(require_proxy_user),
):
    """
    Calculate Gauge R&R (Average & Range or ANOVA) from measurement data.

    Args:
        body: Validated MSA calculation request containing measurement data,
            tolerance, and calculation method.
        user: Authenticated user identity.

    Returns:
        Dictionary containing Gauge R&R results (repeatability, reproducibility, etc.).

    Raises:
        HTTPException: If the calculation fails due to domain logic or data errors.
    """
    try:
        return msa_calculate(body)
    except Exception as exc:
        handle_analysis_error(exc)


@router.post("/correlation")
@limiter.limit("5/minute")
async def spc_correlation(
    request: Request,
    body: CorrelationRequest,
    user: UserIdentity = Depends(require_proxy_user),
):
    """Compute pairwise Pearson correlation for all qualified MIC pairs."""
    token = user.raw_token
    check_warehouse_config()
    try:
        payload = await fetch_correlation(
            token,
            body.material_id,
            body.plant_id,
            body.date_from,
            body.date_to,
            body.min_batches,
        )
    except Exception as exc:
        handle_analysis_error(exc)

    return await attach_data_freshness(
        payload,
        token,
        ["spc_correlation_source_mv"],
        request_path=request.url.path,
    )


@router.post("/correlation-scatter")
@limiter.limit("20/minute")
async def spc_correlation_scatter(
    request: Request,
    body: CorrelationScatterRequest,
    user: UserIdentity = Depends(require_proxy_user),
):
    """Retrieve scatter plot data for a specific MIC pair."""
    token = user.raw_token
    check_warehouse_config()
    try:
        return await fetch_correlation_scatter(
            token,
            body.material_id,
            body.mic_a_id,
            body.mic_b_id,
            body.plant_id,
            body.date_from,
            body.date_to,
        )
    except Exception as exc:
        handle_analysis_error(exc)


@router.post("/multivariate")
@limiter.limit("10/minute")
async def spc_multivariate(
    request: Request,
    body: MultivariateRequest,
    user: UserIdentity = Depends(require_proxy_user),
):
    """Compute Hotelling T² multivariate SPC chart for selected MICs."""
    token = user.raw_token
    check_warehouse_config()
    try:
        payload = await fetch_multivariate(
            token,
            body.material_id,
            body.mic_ids,
            body.plant_id,
            body.date_from,
            body.date_to,
        )
    except Exception as exc:
        handle_analysis_error(exc)

    return await attach_data_freshness(
        payload,
        token,
        ["spc_correlation_source_mv"],
        request_path=request.url.path,
    )
