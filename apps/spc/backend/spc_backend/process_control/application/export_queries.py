"""
Application data fetchers for SPC export endpoints.
"""

from __future__ import annotations

from typing import Optional

from spc_backend.process_control.application.analysis import fetch_scorecard
from spc_backend.process_control.application.charts import (
    fetch_count_chart_data,
    fetch_p_chart_data,
)
from spc_backend.process_control.dal.authorized_scope import assert_plant_authorized
from spc_backend.process_control.dal.charts import fetch_chart_data as _fetch_chart_data


async def fetch_chart_data(
    token: str,
    material_id: str,
    mic_id: str,
    mic_name: Optional[str],
    plant_id: Optional[str],
    date_from: Optional[str],
    date_to: Optional[str],
    stratify_by: Optional[str] = None,
    operation_id: Optional[str] = None,
) -> list[dict]:
    """Return full measurement rows for export after plant authorization."""
    await assert_plant_authorized(token, plant_id)
    return await _fetch_chart_data(
        token,
        material_id,
        mic_id,
        mic_name,
        plant_id,
        date_from,
        date_to,
        stratify_by,
        operation_id=operation_id,
    )
