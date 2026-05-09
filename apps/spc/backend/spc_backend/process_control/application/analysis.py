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
    """Return the SPC scorecard after verifying plant authorization.

    Args:
        token: Databricks access token forwarded from the proxy header.
        material_id: SAP material identifier.
        plant_id: Optional SAP plant identifier; ``None`` means all authorized plants.
        date_from: ISO date string (YYYY-MM-DD) start of range, or ``None``.
        date_to: ISO date string (YYYY-MM-DD) end of range, or ``None``.

    Returns:
        List of scorecard row dicts from the DAL.
    """
    await assert_plant_authorized(token, plant_id)
    return await _dal.fetch_scorecard(token, material_id, plant_id, date_from, date_to)


async def fetch_compare_scorecard(
    token: str,
    material_ids: list[str],
    plant_id: Optional[str],
    date_from: Optional[str],
    date_to: Optional[str],
) -> dict:
    """Return the cross-material compare scorecard after verifying plant authorization.

    Args:
        token: Databricks access token forwarded from the proxy header.
        material_ids: List of SAP material identifiers to compare.
        plant_id: Optional SAP plant identifier; ``None`` means all authorized plants.
        date_from: ISO date string (YYYY-MM-DD) start of range, or ``None``.
        date_to: ISO date string (YYYY-MM-DD) end of range, or ``None``.

    Returns:
        Compare scorecard dict from the DAL.
    """
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
    """Return the MIC correlation matrix after verifying plant authorization.

    Args:
        token: Databricks access token forwarded from the proxy header.
        material_id: SAP material identifier.
        plant_id: Optional SAP plant identifier; ``None`` means all authorized plants.
        date_from: ISO date string (YYYY-MM-DD) start of range, or ``None``.
        date_to: ISO date string (YYYY-MM-DD) end of range, or ``None``.
        min_batches: Minimum batch count required for a characteristic pair to be included.

    Returns:
        Correlation matrix dict from the DAL.
    """
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
    """Return scatter data for a MIC-pair correlation chart after verifying plant authorization.

    Args:
        token: Databricks access token forwarded from the proxy header.
        material_id: SAP material identifier.
        mic_a_id: First characteristic identifier (x-axis).
        mic_b_id: Second characteristic identifier (y-axis).
        plant_id: Optional SAP plant identifier; ``None`` means all authorized plants.
        date_from: ISO date string (YYYY-MM-DD) start of range, or ``None``.
        date_to: ISO date string (YYYY-MM-DD) end of range, or ``None``.

    Returns:
        Scatter data dict from the DAL.
    """
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
    """Return Hotelling T² multivariate chart data after verifying plant authorization.

    Args:
        token: Databricks access token forwarded from the proxy header.
        material_id: SAP material identifier.
        mic_ids: List of characteristic identifiers to include in the T² calculation.
        plant_id: Optional SAP plant identifier; ``None`` means all authorized plants.
        date_from: ISO date string (YYYY-MM-DD) start of range, or ``None``.
        date_to: ISO date string (YYYY-MM-DD) end of range, or ``None``.

    Returns:
        Multivariate chart dict from the DAL.
    """
    await assert_plant_authorized(token, plant_id)
    return await _dal.fetch_multivariate(token, material_id, mic_ids, plant_id, date_from, date_to)


# No plant_id — delegate directly.
fetch_process_flow = _dal.fetch_process_flow
save_msa_session = _dal.save_msa_session


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
    increment_observability_counter("spc.msa.calculated", tags={"method": body.method})
    if body.method == "anova":
        return compute_grr_anova(body.measurement_data, body.tolerance)
    return compute_grr(body.measurement_data, body.tolerance)
