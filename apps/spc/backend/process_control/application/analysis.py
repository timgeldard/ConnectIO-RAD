"""Application query functions for SPC analysis endpoints."""

from backend.process_control.dal.analysis import (
    fetch_compare_scorecard,
    fetch_correlation,
    fetch_correlation_scatter,
    fetch_multivariate,
    fetch_process_flow,
    fetch_scorecard,
    save_msa_session,
)
from backend.process_control.domain.msa import compute_grr, compute_grr_anova
from backend.schemas.spc_schemas import CalculateMSARequest

__all__ = [
    "fetch_compare_scorecard",
    "fetch_correlation",
    "fetch_correlation_scatter",
    "fetch_multivariate",
    "fetch_process_flow",
    "fetch_scorecard",
    "msa_calculate",
    "save_msa_session",
]


def msa_calculate(body: CalculateMSARequest) -> dict:
    """Dispatch a Gauge R&R calculation to the appropriate domain function.

    Routes to the ANOVA method when ``body.method == "anova"``, otherwise uses
    the Average and Range method.

    Args:
        body: Validated MSA calculation request containing measurement data,
            tolerance, and method choice.

    Returns:
        Gauge R&R result dict produced by the domain function.
    """
    if body.method == "anova":
        return compute_grr_anova(body.measurement_data, body.tolerance)
    return compute_grr(body.measurement_data, body.tolerance)
