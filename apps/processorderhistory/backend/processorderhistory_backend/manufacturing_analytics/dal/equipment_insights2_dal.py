"""DAL for Equipment Insights v2 — estate, cleaning, and activity metrics.

Derives all available metrics from the two views used by Equipment Insights v1:
  - vw_gold_instrument        (csm_equipment_history schema, via instrument_tbl()) — instrument master
  - vw_gold_equipment_history (csm_process_order_history schema, via tbl()) — state-change events

Three parallel queries via asyncio.gather:
  1. instrument_master — full equipment register
  2. current_states    — latest STATUS_TO per instrument (last 90 days)
  3. event_timeline    — chronological events per instrument (last 90 days),
                         used for TTC, utilisation, MTBC, dirty age, heatmap,
                         and TTC trend

Fields with no available data source are returned as neutral/zero values:
  - ftr_pct / ftr_trend        — 100.0  (no quality result source)
  - cal_due_days / cal_register — null / [] (scale_verification_results is RESTRICTED)
  - cal_overdue / cal_due_soon  — 0
  - faults_7d                   — 0 (no fault log in existing views)
  - anomaly                     — False (statistical drift detection deferred)
  - criticality                 — 'C' (no criticality classification in master data)

TODO — extend once data becomes available:
  ftr_pct: join vw_gold_equipment_history events to process order quality results
  cal_due_days: create a Unity Catalogue consumption view over scale_verification_results
  anomaly: add sliding-window TTC drift detection in the equipment domain module
"""
import asyncio
from datetime import datetime, timezone as dt_timezone
from typing import Optional

from processorderhistory_backend.db import instrument_tbl, run_sql_async, sql_param, tbl
from processorderhistory_backend.manufacturing_analytics.domain.equipment import (
    build_equipment_register,
    build_heatmap,
    build_kpis,
    build_state_distribution,
    build_ttc_trend,
    build_type_agg,
    compute_per_instrument_metrics,
    group_events_by_instrument,
)

# ---------------------------------------------------------------------------
# Query coroutines
# ---------------------------------------------------------------------------


async def _q_instrument_master(token: str, plant_id: Optional[str]) -> list[dict]:
    """SELECT full instrument register from vw_gold_instrument.

    Single-Use Vessel rows are excluded to match the v1 filter.
    Plant filtering is optional — omitting plant_id returns all plants.
    """
    plant_clause = "AND PLANT_ID = :plant_id" if plant_id else ""
    params: Optional[list[dict]] = [sql_param("plant_id", plant_id)] if plant_id else None
    query = f"""
        SELECT
            INSTRUMENT_ID,
            INSTRUMENT_NAME,
            EQUIPMENT_TYPE,
            EQUIPMENT_SUB_TYPE,
            PRODUCTION_LINE,
            PLANT_ID
        FROM {instrument_tbl('vw_gold_instrument')}
        WHERE EQUIPMENT_TYPE != 'Single-Use Vessel'
          {plant_clause}
    """
    return await run_sql_async(
        token, query, params, endpoint_hint="poh.equipment_insights2.master"
    )


async def _q_current_states(token: str, plant_id: Optional[str]) -> list[dict]:
    """Latest STATUS_TO per instrument from vw_gold_equipment_history.

    Uses the same ROW_NUMBER pattern as Equipment Insights v1. No time-window
    filter so instruments with no recent activity still appear in the state
    distribution rather than being silently dropped.
    """
    plant_clause = "AND PLANT_ID = :plant_id" if plant_id else ""
    params: Optional[list[dict]] = [sql_param("plant_id", plant_id)] if plant_id else None
    query = f"""
        WITH latest_eh AS (
            SELECT
                INSTRUMENT_ID,
                STATUS_TO,
                ROW_NUMBER() OVER (PARTITION BY INSTRUMENT_ID ORDER BY CHANGE_AT DESC) AS rn
            FROM {tbl('vw_gold_equipment_history')}
            WHERE EQUIPMENT_TYPE != 'Single-Use Vessel'
              {plant_clause}
        )
        SELECT
            INSTRUMENT_ID AS instrument_id,
            STATUS_TO     AS status_to
        FROM latest_eh
        WHERE rn = 1
    """
    return await run_sql_async(
        token, query, params, endpoint_hint="poh.equipment_insights2.states"
    )


async def _q_event_timeline(token: str, plant_id: Optional[str]) -> list[dict]:
    """Chronological state-change events for every instrument over the last 90 days.

    CHANGE_AT is converted to epoch milliseconds (change_at_ms) so that
    Python-side time arithmetic does not need to parse timestamp strings.
    Rows are ordered by instrument then time — the ORDER BY guarantees
    that group_events_by_instrument receives sorted sublists.
    """
    plant_clause = "AND PLANT_ID = :plant_id" if plant_id else ""
    params: Optional[list[dict]] = [sql_param("plant_id", plant_id)] if plant_id else None
    query = f"""
        SELECT
            INSTRUMENT_ID                                     AS instrument_id,
            STATUS_TO                                         AS status_to,
            CAST(UNIX_TIMESTAMP(CHANGE_AT) * 1000 AS BIGINT) AS change_at_ms
        FROM {tbl('vw_gold_equipment_history')}
        WHERE CHANGE_AT >= current_timestamp() - INTERVAL 90 DAYS
          AND EQUIPMENT_TYPE != 'Single-Use Vessel'
          {plant_clause}
        ORDER BY INSTRUMENT_ID, change_at_ms ASC
    """
    return await run_sql_async(
        token, query, params, endpoint_hint="poh.equipment_insights2.timeline"
    )


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------


async def fetch_equipment_insights2(
    token: str,
    *,
    plant_id: Optional[str] = None,
    timezone: str = "UTC",
) -> dict:
    """Fetch Equipment Insights v2 payload via three parallel Databricks queries.

    Derives estate, state distribution, cleaning backlog, heatmap, TTC trend,
    and per-instrument metrics from vw_gold_instrument and vw_gold_equipment_history.

    Args:
        token: Databricks access token forwarded from the proxy header.
        plant_id: Optional plant filter — omit to return all plants.
        timezone: IANA timezone name (from validate_timezone) for day/hour alignment.

    Returns:
        Dict matching the ``EquipmentInsights2Summary`` frontend TypeScript type.
        ``data_available`` is True once this function returns real data.
    """
    now_ms = int(datetime.now(dt_timezone.utc).timestamp() * 1000)

    instruments, state_rows, event_rows = await asyncio.gather(
        _q_instrument_master(token, plant_id),
        _q_current_states(token, plant_id),
        _q_event_timeline(token, plant_id),
    )

    state_by_id = {r["instrument_id"]: r["status_to"] for r in state_rows}
    events_by_instrument = group_events_by_instrument(event_rows)
    metrics_by_id = {
        iid: compute_per_instrument_metrics(evts, now_ms)
        for iid, evts in events_by_instrument.items()
    }
    register = build_equipment_register(instruments, state_by_id, metrics_by_id)
    total_instruments = len(instruments) or 1

    return {
        "kpis":             build_kpis(register),
        "ttc_trend":        build_ttc_trend(events_by_instrument, now_ms, timezone),
        "ftr_trend":        [100.0] * 14,
        "state_agg":        build_state_distribution(state_rows),
        "heatmap":          build_heatmap(event_rows, total_instruments, now_ms, timezone),
        "type_agg":         build_type_agg(register),
        "equipment":        register,
        "cleaning_backlog": sorted(
            [e for e in register if e["state"] == "dirty" and e["dirty_age_min"] is not None],
            key=lambda e: e["dirty_age_min"],
            reverse=True,
        ),
        "cal_register":     [],
        "anomalies":        [],
        "data_available":   True,
    }
