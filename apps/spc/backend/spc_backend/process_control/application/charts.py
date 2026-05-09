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
    """Return a paginated page of SPC measurement data after verifying plant authorization.

    Args:
        token: Databricks access token forwarded from the proxy header.
        material_id: SAP material identifier.
        mic_id: Measurement and inspection characteristic identifier.
        mic_name: Optional human-readable MIC name for display.
        plant_id: Optional SAP plant identifier; ``None`` means all authorized plants.
        date_from: ISO date string (YYYY-MM-DD) start of range, or ``None``.
        date_to: ISO date string (YYYY-MM-DD) end of range, or ``None``.
        stratify_by: Optional column name to stratify results by.
        cursor: Opaque pagination cursor from a previous response, or ``None``.
        limit: Maximum number of data points to return per page.
        operation_id: Optional operation identifier to filter results.

    Returns:
        Paginated chart data dict from the DAL.
    """
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
    """Return the data quality summary after verifying plant authorization.

    Args:
        token: Databricks access token forwarded from the proxy header.
        material_id: SAP material identifier.
        mic_id: Measurement and inspection characteristic identifier.
        plant_id: Optional SAP plant identifier; ``None`` means all authorized plants.
        date_from: ISO date string (YYYY-MM-DD) start of range, or ``None``.
        date_to: ISO date string (YYYY-MM-DD) end of range, or ``None``.
        operation_id: Optional operation identifier to filter results.

    Returns:
        Data quality summary dict from the DAL.
    """
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
    """Return computed control limits after verifying plant authorization.

    Args:
        token: Databricks access token forwarded from the proxy header.
        material_id: SAP material identifier.
        mic_id: Measurement and inspection characteristic identifier.
        plant_id: Optional SAP plant identifier; ``None`` means all authorized plants.
        date_from: ISO date string (YYYY-MM-DD) start of range, or ``None``.
        date_to: ISO date string (YYYY-MM-DD) end of range, or ``None``.
        operation_id: Optional operation identifier to filter results.

    Returns:
        Control limits dict from the DAL.
    """
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
    """Return p-chart (proportion nonconforming) data after verifying plant authorization.

    Args:
        token: Databricks access token forwarded from the proxy header.
        material_id: SAP material identifier.
        mic_id: Measurement and inspection characteristic identifier.
        mic_name: Optional human-readable MIC name for display.
        plant_id: Optional SAP plant identifier; ``None`` means all authorized plants.
        date_from: ISO date string (YYYY-MM-DD) start of range, or ``None``.
        date_to: ISO date string (YYYY-MM-DD) end of range, or ``None``.
        operation_id: Optional operation identifier to filter results.

    Returns:
        List of p-chart data point dicts from the DAL.
    """
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
    """Return count-chart (c/u-chart) data after verifying plant authorization.

    Args:
        token: Databricks access token forwarded from the proxy header.
        material_id: SAP material identifier.
        mic_id: Measurement and inspection characteristic identifier.
        mic_name: Optional human-readable MIC name for display.
        plant_id: Optional SAP plant identifier; ``None`` means all authorized plants.
        date_from: ISO date string (YYYY-MM-DD) start of range, or ``None``.
        date_to: ISO date string (YYYY-MM-DD) end of range, or ``None``.
        operation_id: Optional operation identifier to filter results.

    Returns:
        List of count-chart data point dicts from the DAL.
    """
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
    """Return the normality test summary after verifying plant authorization.

    Args:
        token: Databricks access token forwarded from the proxy header.
        material_id: SAP material identifier.
        mic_id: Measurement and inspection characteristic identifier.
        plant_id: Optional SAP plant identifier; ``None`` means all authorized plants.
        date_from: ISO date string (YYYY-MM-DD) start of range, or ``None``.
        date_to: ISO date string (YYYY-MM-DD) end of range, or ``None``.
        operation_id: Optional operation identifier to filter results.

    Returns:
        Normality summary dict from the DAL.
    """
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
    """Return the specification drift summary after verifying plant authorization.

    Args:
        token: Databricks access token forwarded from the proxy header.
        material_id: SAP material identifier.
        mic_id: Measurement and inspection characteristic identifier.
        plant_id: Optional SAP plant identifier; ``None`` means all authorized plants.
        date_from: ISO date string (YYYY-MM-DD) start of range, or ``None``.
        date_to: ISO date string (YYYY-MM-DD) end of range, or ``None``.
        operation_id: Optional operation identifier to filter results.

    Returns:
        Spec drift summary dict from the DAL.
    """
    await assert_plant_authorized(token, plant_id)
    return await _dal.fetch_spec_drift_summary(
        token, material_id, mic_id, plant_id, date_from, date_to,
        operation_id=operation_id,
    )


# No plant_id — delegate directly.
decode_chart_cursor = _dal.decode_chart_cursor
