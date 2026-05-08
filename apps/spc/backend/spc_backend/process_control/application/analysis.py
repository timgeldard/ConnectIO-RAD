"""Application layer for SPC analysis endpoints — enforces plant authorization."""

from __future__ import annotations

from typing import Optional

from spc_backend.process_control.dal.authorized_scope import assert_plant_authorized
from spc_backend.process_control.dal import analysis as _dal
from spc_backend.process_control.domain.msa import compute_grr, compute_grr_anova
from spc_backend.schemas.spc_schemas import CalculateMSARequest
from shared_db.errors import increment_observability_counter


async def fetch_scorecard(
    token: str,
    material_id: str,
    plant_id: Optional[str],
    date_from: Optional[str],
    date_to: Optional[str],
) -> list[dict]:
    """Scorecard with plant authorization guard."""
    await assert_plant_authorized(token, plant_id)
    return await _dal.fetch_scorecard(token, material_id, plant_id, date_from, date_to)


async def fetch_compare_scorecard(
    token: str,
    material_ids: list[str],
    plant_id: Optional[str],
    date_from: Optional[str],
    date_to: Optional[str],
) -> dict:
    """Compare-scorecard with plant authorization guard."""
    await assert_plant_authorized(token, plant_id)
    return await _dal.fetch_compare_scorecard(token, material_ids, plant_id, date_from, date_to)


async def fetch_correlation(
    token: str,
    material_id: str,
    plant_id: Optional[str],
    date_from: Optional[str],
    date_to: Optional[str],
    min_batches: int,
) -> dict:
    """Correlation matrix with plant authorization guard."""
    await assert_plant_authorized(token, plant_id)
    return await _dal.fetch_correlation(token, material_id, plant_id, date_from, date_to, min_batches)


async def fetch_correlation_scatter(
    token: str,
    material_id: str,
    mic_a_id: str,
    mic_b_id: str,
    plant_id: Optional[str],
    date_from: Optional[str],
    date_to: Optional[str],
) -> dict:
    """Correlation scatter data with plant authorization guard."""
    await assert_plant_authorized(token, plant_id)
    return await _dal.fetch_correlation_scatter(
        token, material_id, mic_a_id, mic_b_id, plant_id, date_from, date_to,
    )


async def fetch_multivariate(
    token: str,
    material_id: str,
    mic_ids: list[str],
    plant_id: Optional[str],
    date_from: Optional[str],
    date_to: Optional[str],
) -> dict:
    """Hotelling T² multivariate chart with plant authorization guard."""
    await assert_plant_authorized(token, plant_id)
    return await _dal.fetch_multivariate(token, material_id, mic_ids, plant_id, date_from, date_to)


# No plant_id — delegate directly.
fetch_process_flow = _dal.fetch_process_flow
save_msa_session = _dal.save_msa_session


def msa_calculate(body: CalculateMSARequest) -> dict:
    """Dispatch a Gauge R&R calculation to the appropriate domain function.

    Routes to the ANOVA method when ``body.method == "anova"``, otherwise uses
    the Average and Range method.
    """
    increment_observability_counter("spc.msa.calculated", tags={"method": body.method})
    if body.method == "anova":
        return compute_grr_anova(body.measurement_data, body.tolerance)
    return compute_grr(body.measurement_data, body.tolerance)
