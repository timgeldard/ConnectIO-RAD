"""DAL stub for Equipment Insights v2.

Returns empty/zero data structures pending Unity Catalogue gold view creation for:

  - vw_gold_equipment_estate  — TTC, FTR, utilisation, and MTBC per vessel/mixer/reactor
  - vw_gold_equipment_cleaning — cleaning backlog (dirty duration per vessel, CIP history)
  - vw_gold_equipment_calibration — calibration due dates per instrument
  - vw_gold_equipment_anomaly — statistical drift detection (TTC / pour error / cycle time)

TODO: Replace each stub section with real SQL queries once the above views are promoted
to the gold layer in Unity Catalogue.  Follow the patterns in equipment_insights_dal.py:
  - run_sql_async with sql_param for all user-supplied values
  - tbl() for all table references
  - asyncio.gather for parallel queries
  - validate_timezone / tz_day_ms / tz_hour_ms for time bucketing
"""
from typing import Optional


async def fetch_equipment_insights2(
    token: str,
    *,
    plant_id: Optional[str] = None,
    timezone: str = "UTC",
) -> dict:
    """Return empty Equipment Insights v2 payload.

    All arrays are empty and all KPI counters are zero until the gold views
    listed in this module's docstring are available.

    Args:
        token: Databricks access token forwarded from the proxy header.
        plant_id: Optional plant filter (not applied until data is available).
        timezone: IANA timezone string for day/hour bucketing (not applied yet).

    Returns:
        Dict matching the ``EquipmentInsights2Summary`` frontend TypeScript type.
    """
    # TODO: replace with parallel asyncio.gather of real SQL queries once
    # vw_gold_equipment_estate, vw_gold_equipment_cleaning,
    # vw_gold_equipment_calibration, and vw_gold_equipment_anomaly are available.
    return {
        "kpis": {
            "avg_ttc_min": 0,
            "avg_ftr_pct": 0.0,
            "avg_utilisation_pct": 0.0,
            "dirty_count": 0,
            "dirty_over_4h": 0,
            "cal_overdue": 0,
            "cal_due_soon": 0,
            "total_dirty_time_min": 0,
            "anomaly_count": 0,
        },
        "ttc_trend": [],
        "ftr_trend": [],
        "state_agg": [],
        "heatmap": [],
        "type_agg": [],
        "equipment": [],
        "cleaning_backlog": [],
        "cal_register": [],
        "anomalies": [],
    }
