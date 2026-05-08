"""Application layer for SPC chart endpoints — enforces plant authorization."""

from __future__ import annotations

from typing import Optional

from spc_backend.process_control.dal.authorized_scope import assert_plant_authorized
from spc_backend.process_control.dal import charts as _dal


async def fetch_chart_data_page(
    token: str,
    material_id: str,
    mic_id: str,
    mic_name: Optional[str],
    plant_id: Optional[str],
    date_from: Optional[str],
    date_to: Optional[str],
    stratify_by: Optional[str] = None,
    cursor: Optional[str] = None,
    limit: int = 1000,
    operation_id: Optional[str] = None,
) -> dict:
    """Paginated chart data with plant authorization guard."""
    await assert_plant_authorized(token, plant_id)
    return await _dal.fetch_chart_data_page(
        token, material_id, mic_id, mic_name, plant_id,
        date_from, date_to, stratify_by, cursor=cursor, limit=limit,
        operation_id=operation_id,
    )


async def fetch_data_quality_summary(
    token: str,
    material_id: str,
    mic_id: str,
    plant_id: Optional[str],
    date_from: Optional[str],
    date_to: Optional[str],
    operation_id: Optional[str] = None,
) -> dict:
    """Data quality summary with plant authorization guard."""
    await assert_plant_authorized(token, plant_id)
    return await _dal.fetch_data_quality_summary(
        token, material_id, mic_id, plant_id, date_from, date_to,
        operation_id=operation_id,
    )


async def fetch_control_limits(
    token: str,
    material_id: str,
    mic_id: str,
    plant_id: Optional[str],
    date_from: Optional[str],
    date_to: Optional[str],
    operation_id: Optional[str] = None,
) -> dict:
    """Control limits with plant authorization guard."""
    await assert_plant_authorized(token, plant_id)
    return await _dal.fetch_control_limits(
        token, material_id, mic_id, plant_id, date_from, date_to,
        operation_id=operation_id,
    )


async def fetch_p_chart_data(
    token: str,
    material_id: str,
    mic_id: str,
    mic_name: Optional[str],
    plant_id: Optional[str],
    date_from: Optional[str],
    date_to: Optional[str],
    operation_id: Optional[str] = None,
) -> list[dict]:
    """P-chart data with plant authorization guard."""
    await assert_plant_authorized(token, plant_id)
    return await _dal.fetch_p_chart_data(
        token, material_id, mic_id, mic_name, plant_id, date_from, date_to,
        operation_id=operation_id,
    )


async def fetch_count_chart_data(
    token: str,
    material_id: str,
    mic_id: str,
    mic_name: Optional[str],
    plant_id: Optional[str],
    date_from: Optional[str],
    date_to: Optional[str],
    operation_id: Optional[str] = None,
) -> list[dict]:
    """Count-chart data with plant authorization guard."""
    await assert_plant_authorized(token, plant_id)
    return await _dal.fetch_count_chart_data(
        token, material_id, mic_id, mic_name, plant_id, date_from, date_to,
        operation_id=operation_id,
    )


async def fetch_normality_summary(
    token: str,
    material_id: str,
    mic_id: str,
    plant_id: Optional[str],
    date_from: Optional[str],
    date_to: Optional[str],
    operation_id: Optional[str] = None,
) -> dict:
    """Normality summary with plant authorization guard."""
    await assert_plant_authorized(token, plant_id)
    return await _dal.fetch_normality_summary(
        token, material_id, mic_id, plant_id, date_from, date_to,
        operation_id=operation_id,
    )


async def fetch_spec_drift_summary(
    token: str,
    material_id: str,
    mic_id: str,
    plant_id: Optional[str],
    date_from: Optional[str],
    date_to: Optional[str],
    operation_id: Optional[str] = None,
) -> dict:
    """Spec drift summary with plant authorization guard."""
    await assert_plant_authorized(token, plant_id)
    return await _dal.fetch_spec_drift_summary(
        token, material_id, mic_id, plant_id, date_from, date_to,
        operation_id,
    )


# No plant_id — delegate directly.
decode_chart_cursor = _dal.decode_chart_cursor
