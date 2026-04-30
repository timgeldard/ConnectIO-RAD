"""DAL for equipment insights — instrument master distribution and live activity.

Runs four Databricks queries in parallel (asyncio.gather):
  1. type_distribution  — COUNT(*) GROUP BY EQUIPMENT_SUB_TYPE from vw_gold_instrument
  2. activity_daily30d  — distinct active instruments per local day, last 30 days
  3. activity_hourly24h — distinct active instruments per local hour, last 24 hours
  4. current_states     — latest STATUS_TO per instrument (for state/readiness distribution)

Type grouping is derived in Python via _SUBTYPE_TO_TYPE because EQUIPMENT_TYPE exists
in the bronze source but has not yet been promoted to vw_gold_instrument.

State classification uses keyword heuristics against STATUS_TO, mirroring the logic in
vessel_planning_dal.py (keyword sets are intentionally re-declared here to keep each
DAL self-contained — no cross-DAL imports).

Scale verification (connected_plant_prod.tulip.scale_verification_results) is intentionally
NOT queried here.  That table requires a Unity Catalogue consumption view before it can be
accessed safely.  See the TODO in EquipmentInsights.tsx for the frontend placeholder.

TODO — type promotion:
  Once EQUIPMENT_TYPE is added to vw_gold_instrument (promote from bronze),
  replace the _aggregate_by_type step with a direct GROUP BY EQUIPMENT_TYPE in the SQL
  and remove _SUBTYPE_TO_TYPE.
"""
import asyncio
from collections import defaultdict
from datetime import datetime, timedelta, timezone as dt_timezone
from typing import Optional
from zoneinfo import ZoneInfo

from backend.db import instrument_tbl, run_sql_async, sql_param, tbl, tz_day_ms, tz_hour_ms

# ---------------------------------------------------------------------------
# Subtype → type mapping
# TODO: Remove once EQUIPMENT_TYPE is promoted from bronze to vw_gold_instrument.
#
# Note: Pallet and Processing Unit both have NULL EQUIPMENT_SUB_TYPE in the
# current gold view. They cannot be distinguished by subtype alone and will
# appear as "Uncategorised" until the type column is available.
# ---------------------------------------------------------------------------

_SUBTYPE_TO_TYPE: dict[str, str] = {
    "Bucket":          "Auxiliary Equipment",
    "Buckets":         "Auxiliary Equipment",  # legacy spelling variant
    "CCP Screen":      "Auxiliary Equipment",
    "Other":           "Auxiliary Equipment",
    "Pump":            "Auxiliary Equipment",
    "Connected Scale": "Scale",
    "Manual Scale":    "Scale",
    "Fixed":           "Vessel",
    "Mobile":          "Vessel",
    "Mobile-FixBin":   "Vessel",
    "ZIBC":            "Vessel",
}

_UNCATEGORISED = "Uncategorised"

# ---------------------------------------------------------------------------
# State keyword sets — matched against upper-cased STATUS_TO.
# Intentionally re-declared from vessel_planning_dal.py to keep DALs independent.
# ---------------------------------------------------------------------------

_IN_USE_KEYWORDS = frozenset({
    'IN USE', 'IN-USE', 'INUSE', 'RUNNING', 'OCCUPIED', 'ACTIVE', 'PRODUCTION', 'PROCESS',
    'IN PRODUCTION', 'IN PROCESS',
})
_DIRTY_KEYWORDS = frozenset({
    'DIRTY', 'UNCLEAN', 'CLEAN REQUIRED', 'NEEDS CLEAN', 'NEED CLEAN',
    'CIP REQUIRED', 'SOAKING', 'RINSE', 'AWAITING CLEAN',
})
_AVAILABLE_KEYWORDS = frozenset({
    'AVAILABLE', 'CLEAN', 'FREE', 'READY', 'IDLE', 'EMPTY',
    'SANITISED', 'SANITIZED', 'CLEANED',
})


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
    totals: dict[str, int] = defaultdict(int)
    for row in sub_type_rows:
        sub_type = row.get("equipment_sub_type")
        count = int(row.get("instrument_count") or 0)
        equipment_type = _SUBTYPE_TO_TYPE.get(sub_type, _UNCATEGORISED) if sub_type else _UNCATEGORISED
        totals[equipment_type] += count
    return [
        {"equipment_type": et, "instrument_count": c}
        for et, c in sorted(totals.items(), key=lambda kv: -kv[1])
    ]


def _derive_equipment_insights(type_rows: list[dict]) -> dict:
    """Build the estate summary from type-aggregated rows.

    Returns a dict containing:
      - ``total_instrument_count`` — sum of all instrument counts
      - ``type_distribution``      — list of {equipment_type, count, pct} dicts, sorted descending
    """
    total = sum(int(r.get("instrument_count") or 0) for r in type_rows)
    type_distribution = [
        {
            "equipment_type": str(r.get("equipment_type") or "Unknown"),
            "count": int(r.get("instrument_count") or 0),
            "pct": round(int(r.get("instrument_count") or 0) / total * 100, 1) if total else 0.0,
        }
        for r in type_rows
    ]
    return {
        "total_instrument_count": total,
        "type_distribution": type_distribution,
    }


def _classify_state(status_to: Optional[str]) -> str:
    """Classify a STATUS_TO string into a state bucket.

    Returns one of: 'in_use', 'dirty', 'available', 'unknown'.
    Matching is case-insensitive substring search against the keyword frozensets.
    Mirrors the classification logic in vessel_planning_dal.py.
    """
    if not status_to:
        return "unknown"
    upper = status_to.upper().strip()
    if any(kw in upper for kw in _IN_USE_KEYWORDS):
        return "in_use"
    if any(kw in upper for kw in _DIRTY_KEYWORDS):
        return "dirty"
    if any(kw in upper for kw in _AVAILABLE_KEYWORDS):
        return "available"
    return "unknown"


def _build_state_distribution(state_rows: list[dict]) -> list[dict]:
    """Count instruments per state bucket from latest-event rows.

    Returns a list of {state, count, pct} dicts in fixed order:
    in_use → dirty → available → unknown.
    """
    counts: dict[str, int] = {"in_use": 0, "dirty": 0, "available": 0, "unknown": 0}
    for row in state_rows:
        state = _classify_state(row.get("status_to"))
        counts[state] += 1
    total = sum(counts.values())
    return [
        {
            "state": state,
            "count": count,
            "pct": round(count / total * 100, 1) if total else 0.0,
        }
        for state, count in counts.items()
    ]


def _build_activity_daily(
    rows: list[dict], now_ms: int, tz_name: str = "UTC"
) -> list[dict]:
    """Build a zero-padded 30-day series of distinct active instruments per local day.

    Bucket boundaries align to local midnight in ``tz_name``.
    Missing days are filled with 0.
    """
    tz = ZoneInfo(tz_name)
    now_utc = datetime.fromtimestamp(now_ms / 1000, tz=dt_timezone.utc)
    local_today = now_utc.astimezone(tz).replace(hour=0, minute=0, second=0, microsecond=0)
    day_buckets = [
        int((local_today - timedelta(days=29 - i)).astimezone(dt_timezone.utc).timestamp() * 1000)
        for i in range(30)
    ]
    sparse = {int(r["day_ms"]): int(r.get("active_instruments") or 0) for r in rows}
    return [{"date": d, "active_instruments": sparse.get(d, 0)} for d in day_buckets]


def _build_activity_hourly(
    rows: list[dict], now_ms: int, tz_name: str = "UTC"
) -> list[dict]:
    """Build a zero-padded 24-hour series of distinct active instruments per local hour.

    Bucket boundaries align to local hour starts in ``tz_name``.
    Missing hours are filled with 0.
    """
    tz = ZoneInfo(tz_name)
    now_utc = datetime.fromtimestamp(now_ms / 1000, tz=dt_timezone.utc)
    local_now_hour = now_utc.astimezone(tz).replace(minute=0, second=0, microsecond=0)
    hour_buckets = [
        int((local_now_hour - timedelta(hours=24 - i)).astimezone(dt_timezone.utc).timestamp() * 1000)
        for i in range(24)
    ]
    sparse = {int(r["hour_ms"]): int(r.get("active_instruments") or 0) for r in rows}
    return [{"hour": h, "active_instruments": sparse.get(h, 0)} for h in hour_buckets]


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
