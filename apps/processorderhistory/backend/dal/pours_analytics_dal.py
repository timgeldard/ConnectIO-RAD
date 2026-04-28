"""DAL for pour analytics — goods-issue movement aggregations.

Runs 4 Databricks queries in parallel (asyncio.gather):
  1. events_range  — movement type-261 events for the requested date range
  2. daily30d      — daily pour count by line, last 30 days (always fixed, used for context chart)
  3. hourly24h     — hourly pour count by line, last 24h (always fixed, used for context chart)
  4. scheduled     — silver scheduled order count for the requested date range

``daily30d`` and ``hourly24h`` return dicts keyed by line_id (plus "ALL") with
zero-padded series ready for the trend charts.

If ``date_from`` / ``date_to`` are omitted the events and scheduled queries fall
back to a 24-hour rolling window for backward compatibility.

TODO — shift attribution:
  Shift is currently unresolved (all events have shift=None).  Proper resolution
  requires a shift-pattern table that maps plant + calendar date + time range →
  shift label.  Open questions before implementing:
    1. Where does the shift-pattern master live (SAP HR / local config / Databricks table)?
    2. How are exceptions handled — public holidays, changeovers, unplanned stoppages?
    3. Are shift boundaries consistent across all plants and lines, or per-line?
  Until this is resolved the "Shift" breakdown on the Pour Analytics page will
  show all events as a single unlabelled bucket.
"""
import asyncio
from datetime import datetime, timezone
from typing import Optional

from backend.db import run_sql_async, silver_tbl, sql_param, tbl

_MS_PER_HOUR = 3_600_000
_MS_PER_DAY = 86_400_000


# ---------------------------------------------------------------------------
# Individual query coroutines
# ---------------------------------------------------------------------------

async def _q_events_range(
    token: str,
    date_from: Optional[str],
    date_to: Optional[str],
) -> list[dict]:
    """Movement type-261 events for the requested date range, including process order and operator.

    Falls back to the last-24h rolling window when no dates are supplied.
    """
    if date_from and date_to:
        date_clause = (
            "AND DATE(adp.DATE_TIME_OF_ENTRY) >= :date_from"
            " AND DATE(adp.DATE_TIME_OF_ENTRY) <= :date_to"
        )
        params = [sql_param("date_from", date_from), sql_param("date_to", date_to)]
    else:
        date_clause = "AND adp.DATE_TIME_OF_ENTRY >= current_timestamp() - INTERVAL 24 HOURS"
        params = None

    query = f"""
        SELECT
            adp.PROCESS_ORDER_ID                                               AS process_order,
            COALESCE(m.MATERIAL_NAME, adp.MATERIAL_ID)                        AS material_name,
            adp.QUANTITY                                                       AS quantity,
            adp.UOM                                                            AS uom,
            adp.STORAGE_ID                                                     AS source_area,
            adp.SOURCE_ST                                                      AS source_type,
            adp.`USER`                                                         AS operator,
            CAST(UNIX_TIMESTAMP(adp.DATE_TIME_OF_ENTRY) * 1000 AS BIGINT)     AS ts_ms,
            COALESCE(spo.PROCESS_LINE, 'UNKNOWN')                              AS line_id
        FROM {tbl('vw_gold_adp_movement')} adp
        LEFT JOIN {tbl('vw_gold_material')} m
            ON m.MATERIAL_ID = adp.MATERIAL_ID
           AND m.LANGUAGE_ID = 'E'
        LEFT JOIN {silver_tbl('silver_process_order')} spo
            ON spo.PROCESS_ORDER_ID = adp.PROCESS_ORDER_ID
        WHERE adp.MOVEMENT_TYPE = '261'
          AND adp.UOM != 'EA'
          {date_clause}
        ORDER BY adp.DATE_TIME_OF_ENTRY
    """
    return await run_sql_async(token, query, params, endpoint_hint="poh.pours.events_range")


async def _q_daily30d(token: str) -> list[dict]:
    """Daily pour count by line over the last 30 days (always fixed; feeds the context chart)."""
    query = f"""
        SELECT
            CAST(UNIX_TIMESTAMP(DATE_TRUNC('day', adp.DATE_TIME_OF_ENTRY)) * 1000 AS BIGINT)
                AS day_ms,
            COALESCE(spo.PROCESS_LINE, 'UNKNOWN') AS line_id,
            COUNT(*)                               AS pour_count
        FROM {tbl('vw_gold_adp_movement')} adp
        LEFT JOIN {silver_tbl('silver_process_order')} spo
            ON spo.PROCESS_ORDER_ID = adp.PROCESS_ORDER_ID
        WHERE adp.MOVEMENT_TYPE = '261'
          AND adp.UOM != 'EA'
          AND adp.DATE_TIME_OF_ENTRY >= current_timestamp() - INTERVAL 30 DAYS
        GROUP BY day_ms, line_id
        ORDER BY day_ms
    """
    return await run_sql_async(token, query, endpoint_hint="poh.pours.daily30d")


async def _q_hourly24h(token: str) -> list[dict]:
    """Hourly pour count by line over the last 24 hours (always fixed; feeds the context chart)."""
    query = f"""
        SELECT
            CAST(UNIX_TIMESTAMP(DATE_TRUNC('hour', adp.DATE_TIME_OF_ENTRY)) * 1000 AS BIGINT)
                AS hour_ms,
            COALESCE(spo.PROCESS_LINE, 'UNKNOWN') AS line_id,
            COUNT(*)                               AS pour_count
        FROM {tbl('vw_gold_adp_movement')} adp
        LEFT JOIN {silver_tbl('silver_process_order')} spo
            ON spo.PROCESS_ORDER_ID = adp.PROCESS_ORDER_ID
        WHERE adp.MOVEMENT_TYPE = '261'
          AND adp.UOM != 'EA'
          AND adp.DATE_TIME_OF_ENTRY >= current_timestamp() - INTERVAL 24 HOURS
        GROUP BY hour_ms, line_id
        ORDER BY hour_ms
    """
    return await run_sql_async(token, query, endpoint_hint="poh.pours.hourly24h")


async def _q_scheduled_range(
    token: str,
    plant_id: Optional[str],
    date_from: Optional[str],
    date_to: Optional[str],
) -> list[dict]:
    """Count of silver process orders scheduled to start in the requested date range.

    Falls back to the last-24h rolling window when no dates are supplied.
    """
    if date_from and date_to:
        date_clause = (
            "AND DATE(SCHEDULED_START) >= :date_from"
            " AND DATE(SCHEDULED_START) <= :date_to"
        )
    else:
        date_clause = (
            "AND SCHEDULED_START >= current_timestamp() - INTERVAL 24 HOURS"
            " AND SCHEDULED_START < current_timestamp()"
        )

    plant_clause = "AND PLANT_ID = :plant_id" if plant_id else ""

    params: list[dict] = []
    if plant_id:
        params.append(sql_param("plant_id", plant_id))
    if date_from and date_to:
        params.append(sql_param("date_from", date_from))
        params.append(sql_param("date_to", date_to))

    query = f"""
        SELECT COUNT(DISTINCT PROCESS_ORDER_ID) AS scheduled_count
        FROM {silver_tbl('silver_process_order')}
        WHERE 1=1
          {plant_clause}
          {date_clause}
    """
    return await run_sql_async(
        token, query, params or None, endpoint_hint="poh.pours.scheduled_range"
    )


# ---------------------------------------------------------------------------
# Coerce helpers
# ---------------------------------------------------------------------------

def _coerce_event(row: dict) -> dict:
    """Coerce Databricks string-serialised values in an event row."""
    v = row.get("quantity")
    row["quantity"] = float(v) if v is not None else 0.0
    v = row.get("ts_ms")
    row["ts_ms"] = int(v) if v is not None else 0
    v = row.get("source_type")
    row["source_type"] = str(v).strip() if v is not None else None
    row["shift"] = None  # TODO: resolve from shift-pattern table (see module docstring)
    return row


# ---------------------------------------------------------------------------
# Series builders — fill zero-padded 30-day / 24-hour grids
# ---------------------------------------------------------------------------

def _build_daily_series(
    daily_rows: list[dict], now_ms: int
) -> tuple[dict[str, list[dict]], list[str]]:
    """Build zero-padded 30-day series keyed by line_id plus 'ALL'.

    Returns (series_by_line, sorted_line_ids).
    """
    now_day_ms = (now_ms // _MS_PER_DAY) * _MS_PER_DAY
    day_buckets = [now_day_ms - (29 - i) * _MS_PER_DAY for i in range(30)]

    sparse: dict[tuple[int, str], int] = {}
    all_daily: dict[int, int] = {}
    for row in daily_rows:
        d_ms = int(row["day_ms"])
        line = str(row["line_id"])
        count = int(row["pour_count"])
        sparse[(d_ms, line)] = sparse.get((d_ms, line), 0) + count
        all_daily[d_ms] = all_daily.get(d_ms, 0) + count

    lines = sorted({line for (_, line) in sparse})

    series_by_line: dict[str, list[dict]] = {
        "ALL": [
            {"date": d, "actual": all_daily.get(d, 0), "target": None, "planned": None}
            for d in day_buckets
        ]
    }
    for line in lines:
        series_by_line[line] = [
            {"date": d, "actual": sparse.get((d, line), 0), "target": None, "planned": None}
            for d in day_buckets
        ]

    return series_by_line, lines


def _build_hourly_series(
    hourly_rows: list[dict], now_ms: int
) -> dict[str, list[dict]]:
    """Build zero-padded 24-hour series keyed by line_id plus 'ALL'.

    Buckets run from 24 hours ago (hour-truncated) to the most recent completed hour.
    """
    now_hour_ms = (now_ms // _MS_PER_HOUR) * _MS_PER_HOUR
    hour_buckets = [now_hour_ms - (24 - i) * _MS_PER_HOUR for i in range(24)]

    sparse: dict[tuple[int, str], int] = {}
    all_hourly: dict[int, int] = {}
    for row in hourly_rows:
        h_ms = int(row["hour_ms"])
        line = str(row["line_id"])
        count = int(row["pour_count"])
        sparse[(h_ms, line)] = sparse.get((h_ms, line), 0) + count
        all_hourly[h_ms] = all_hourly.get(h_ms, 0) + count

    lines = sorted({line for (_, line) in sparse})

    series_by_line: dict[str, list[dict]] = {
        "ALL": [
            {"hour": h, "actual": all_hourly.get(h, 0), "target": None}
            for h in hour_buckets
        ]
    }
    for line in lines:
        series_by_line[line] = [
            {"hour": h, "actual": sparse.get((h, line), 0), "target": None}
            for h in hour_buckets
        ]

    return series_by_line


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def fetch_pours_analytics(
    token: str,
    *,
    plant_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> dict:
    """Fetch pour analytics via 4 parallel Databricks queries.

    Returns pre-aggregated daily/hourly context series keyed by line_id plus 'ALL',
    plus the raw event list for the requested date range (used by the Breakdown).
    If ``date_from`` / ``date_to`` are omitted, events default to the last-24h window.
    """
    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)

    events_rows, daily_rows, hourly_rows, scheduled_rows = await asyncio.gather(
        _q_events_range(token, date_from, date_to),
        _q_daily30d(token),
        _q_hourly24h(token),
        _q_scheduled_range(token, plant_id, date_from, date_to),
    )

    events = [_coerce_event(r) for r in events_rows]
    daily_series, daily_lines = _build_daily_series(daily_rows, now_ms)
    hourly_series = _build_hourly_series(hourly_rows, now_ms)

    hourly_lines = sorted({k for k in hourly_series if k != "ALL"})
    lines = sorted(set(daily_lines) | set(hourly_lines))

    scheduled_count = int(scheduled_rows[0]["scheduled_count"]) if scheduled_rows else 0

    return {
        "now_ms": now_ms,
        "planned_24h": scheduled_count,
        "lines": lines,
        "events": events,
        "daily30d": daily_series,
        "hourly24h": hourly_series,
    }
