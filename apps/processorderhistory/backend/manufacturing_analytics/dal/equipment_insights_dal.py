"""DAL for equipment insights — instrument master distribution and live activity.

Runs four Databricks queries in parallel (asyncio.gather):
  1. type_distribution  — COUNT(*) GROUP BY EQUIPMENT_SUB_TYPE from vw_gold_instrument
  2. activity_daily30d  — distinct active instruments per local day, last 30 days
  3. activity_hourly24h — distinct active instruments per local hour, last 24 hours
  4. current_states     — latest STATUS_TO per instrument (for state/readiness distribution)

Type grouping is derived in the manufacturing_analytics domain because EQUIPMENT_TYPE
exists in the bronze source but has not yet been promoted to vw_gold_instrument.

State classification uses domain keyword heuristics against STATUS_TO.

Scale verification (connected_plant_prod.tulip.scale_verification_results) is intentionally
NOT queried here.  That table requires a Unity Catalogue consumption view before it can be
accessed safely.  See the TODO in EquipmentInsights.tsx for the frontend placeholder.

TODO — type promotion:
  Once EQUIPMENT_TYPE is added to vw_gold_instrument (promote from bronze),
  replace the _aggregate_by_type step with a direct GROUP BY EQUIPMENT_TYPE in the SQL
  and remove _SUBTYPE_TO_TYPE.
"""
import asyncio
from datetime import datetime, timezone as dt_timezone
from typing import Optional

from backend.db import instrument_tbl, run_sql_async, sql_param, tbl, tz_day_ms, tz_hour_ms
from backend.manufacturing_analytics.domain.equipment import (
    aggregate_by_type,
    build_activity_daily,
    build_activity_hourly,
    build_state_distribution,
    classify_state,
    derive_equipment_insights,
)

# ---------------------------------------------------------------------------
# Query coroutines
# ---------------------------------------------------------------------------


async def _q_type_distribution(token: str, plant_id: Optional[str]) -> list[dict]:
    """COUNT of instruments grouped by EQUIPMENT_SUB_TYPE from vw_gold_instrument.

    Plant filtering is optional — omitting plant_id returns all plants.
    Single-Use Vessel rows are excluded per the trap documented in entities.yaml.
    """
    plant_clause = "AND PLANT_ID = :plant_id" if plant_id else ""
    params: Optional[list[dict]] = [sql_param("plant_id", plant_id)] if plant_id else None

    query = f"""
        SELECT
            EQUIPMENT_SUB_TYPE AS equipment_sub_type,
            COUNT(*)           AS instrument_count
        FROM {instrument_tbl('vw_gold_instrument')}
        WHERE 1=1
          {plant_clause}
        GROUP BY EQUIPMENT_SUB_TYPE
        ORDER BY instrument_count DESC
    """
    return await run_sql_async(
        token, query, params, endpoint_hint="poh.equipment_insights.type_dist"
    )


async def _q_activity_daily30d(token: str, tz: str, plant_id: Optional[str]) -> list[dict]:
    """Distinct active instruments per local calendar day, last 30 days.

    Uses CHANGE_AT (TIMESTAMP) from vw_gold_equipment_history bucketed to the
    user's local timezone. Excludes Single-Use Vessel rows.
    Single-Use Vessel rows are excluded to match the type distribution filter.
    """
    plant_clause = "AND PLANT_ID = :plant_id" if plant_id else ""
    params: Optional[list[dict]] = [sql_param("plant_id", plant_id)] if plant_id else None

    query = f"""
        SELECT
            {tz_day_ms('CHANGE_AT', tz)}      AS day_ms,
            COUNT(DISTINCT INSTRUMENT_ID)      AS active_instruments
        FROM {tbl('vw_gold_equipment_history')}
        WHERE CHANGE_AT >= current_timestamp() - INTERVAL 30 DAYS
          AND EQUIPMENT_TYPE != 'Single-Use Vessel'
          {plant_clause}
        GROUP BY day_ms
        ORDER BY day_ms
    """
    return await run_sql_async(
        token, query, params, endpoint_hint="poh.equipment_insights.activity_daily30d"
    )


async def _q_activity_hourly24h(token: str, tz: str, plant_id: Optional[str]) -> list[dict]:
    """Distinct active instruments per local calendar hour, last 24 hours.

    Mirrors _q_activity_daily30d but over the last 24 hours for the hourly chart.
    """
    plant_clause = "AND PLANT_ID = :plant_id" if plant_id else ""
    params: Optional[list[dict]] = [sql_param("plant_id", plant_id)] if plant_id else None

    query = f"""
        SELECT
            {tz_hour_ms('CHANGE_AT', tz)}     AS hour_ms,
            COUNT(DISTINCT INSTRUMENT_ID)      AS active_instruments
        FROM {tbl('vw_gold_equipment_history')}
        WHERE CHANGE_AT >= current_timestamp() - INTERVAL 24 HOURS
          AND EQUIPMENT_TYPE != 'Single-Use Vessel'
          {plant_clause}
        GROUP BY hour_ms
        ORDER BY hour_ms
    """
    return await run_sql_async(
        token, query, params, endpoint_hint="poh.equipment_insights.activity_hourly24h"
    )


async def _q_current_states(token: str, plant_id: Optional[str]) -> list[dict]:
    """Latest STATUS_TO per instrument from vw_gold_equipment_history.

    Uses ROW_NUMBER() OVER (PARTITION BY INSTRUMENT_ID ORDER BY CHANGE_AT DESC)
    to select the most recent event per instrument, then returns instrument_id and
    status_to for classification in Python.  Restricted to events in the last 90 days
    to keep the CTE selective.
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
            WHERE CHANGE_AT >= current_timestamp() - INTERVAL 90 DAYS
              AND EQUIPMENT_TYPE != 'Single-Use Vessel'
              {plant_clause}
        )
        SELECT
            INSTRUMENT_ID AS instrument_id,
            STATUS_TO     AS status_to
        FROM latest_eh
        WHERE rn = 1
    """
    return await run_sql_async(
        token, query, params, endpoint_hint="poh.equipment_insights.current_states"
    )


# ---------------------------------------------------------------------------
# Derivation helpers — pure Python, testable without SQL mocking
# ---------------------------------------------------------------------------


def _aggregate_by_type(sub_type_rows: list[dict]) -> list[dict]:
    """Aggregate instrument counts from EQUIPMENT_SUB_TYPE up to EQUIPMENT_TYPE.

    Uses _SUBTYPE_TO_TYPE for known mappings. Unknown or null subtypes are
    grouped under 'Uncategorised'.

    Returns a list of {equipment_type, instrument_count} dicts sorted descending
    by count, ready for _derive_equipment_insights.
    """
    return aggregate_by_type(sub_type_rows)


def _derive_equipment_insights(type_rows: list[dict]) -> dict:
    """Build the estate summary from type-aggregated rows.

    Returns a dict containing:
      - ``total_instrument_count`` — sum of all instrument counts
      - ``type_distribution``      — list of {equipment_type, count, pct} dicts, sorted descending
    """
    return derive_equipment_insights(type_rows)


def _classify_state(status_to: Optional[str]) -> str:
    """Classify a STATUS_TO string into a state bucket.

    Returns one of: 'in_use', 'dirty', 'available', 'unknown'.
    Matching is case-insensitive substring search against the keyword frozensets.
    Mirrors the classification logic in vessel_planning_dal.py.
    """
    return classify_state(status_to)


def _build_state_distribution(state_rows: list[dict]) -> list[dict]:
    """Count instruments per state bucket from latest-event rows.

    Returns a list of {state, count, pct} dicts in fixed order:
    in_use → dirty → available → unknown.
    """
    return build_state_distribution(state_rows)


def _build_activity_daily(
    rows: list[dict], now_ms: int, tz_name: str = "UTC"
) -> list[dict]:
    """Build a zero-padded 30-day series of distinct active instruments per local day.

    Bucket boundaries align to local midnight in ``tz_name``.
    Missing days are filled with 0.
    """
    return build_activity_daily(rows, now_ms, tz_name)


def _build_activity_hourly(
    rows: list[dict], now_ms: int, tz_name: str = "UTC"
) -> list[dict]:
    """Build a zero-padded 24-hour series of distinct active instruments per local hour.

    Bucket boundaries align to local hour starts in ``tz_name``.
    Missing hours are filled with 0.
    """
    return build_activity_hourly(rows, now_ms, tz_name)


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------


async def fetch_equipment_insights(
    token: str,
    *,
    plant_id: Optional[str] = None,
    timezone: str = "UTC",
) -> dict:
    """Fetch equipment insights via four parallel Databricks queries.

    Returns:
      - ``total_instrument_count``  — total instruments in the master
      - ``type_distribution``       — counts and percentages by derived EQUIPMENT_TYPE
      - ``state_distribution``      — counts and percentages by state bucket (in_use / dirty / available / unknown)
      - ``activity_daily30d``       — zero-padded 30-day series of distinct active instruments per local day
      - ``activity_hourly24h``      — zero-padded 24-hour series of distinct active instruments per local hour

    ``timezone`` must be a validated IANA timezone name (from ``validate_timezone``).
    Day and hour buckets align to local calendar boundaries in that timezone.
    """
    now_ms = int(datetime.now(dt_timezone.utc).timestamp() * 1000)

    sub_type_rows, daily_rows, hourly_rows, state_rows = await asyncio.gather(
        _q_type_distribution(token, plant_id),
        _q_activity_daily30d(token, timezone, plant_id),
        _q_activity_hourly24h(token, timezone, plant_id),
        _q_current_states(token, plant_id),
    )

    type_rows = _aggregate_by_type(sub_type_rows)
    estate = _derive_equipment_insights(type_rows)
    activity_daily = _build_activity_daily(daily_rows, now_ms, timezone)
    activity_hourly = _build_activity_hourly(hourly_rows, now_ms, timezone)
    state_distribution = _build_state_distribution(state_rows)

    return {
        "total_instrument_count": estate["total_instrument_count"],
        "type_distribution": estate["type_distribution"],
        "state_distribution": state_distribution,
        "activity_daily30d": activity_daily,
        "activity_hourly24h": activity_hourly,
    }
