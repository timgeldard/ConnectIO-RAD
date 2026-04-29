"""DAL for pour analytics — goods-issue movement aggregations.

Runs 3–4 Databricks queries in parallel (asyncio.gather):
  1. events_range  — movement type-261 events for the requested date range
  2. daily30d      — daily pour count, last 30 days (always fixed, used for context chart)
  3. hourly24h     — hourly pour count, last 24h (always fixed, used for context chart)
  4. prior7d       — events for the 7 days before date_from (only when date_from is supplied)

Note: line attribution (silver_process_order JOIN) and planned pour count
(silver_process_order scheduled query) have been removed pending universal access
to the connected_plant_prod.silver schema.  All events return line_id = 'ALL'
and planned_24h is always None.

``daily30d`` and ``hourly24h`` series are keyed by 'ALL' only (no per-line breakdown).

If ``date_from`` / ``date_to`` are omitted the events query falls back to a
24-hour rolling window for backward compatibility.

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

from backend.db import run_sql_async, sql_param, tbl

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
    line_id is hardcoded to 'ALL' — per-line attribution requires silver schema access.
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
            'ALL'                                                               AS line_id
        FROM {tbl('vw_gold_adp_movement')} adp
        LEFT JOIN {tbl('vw_gold_material')} m
            ON m.MATERIAL_ID = adp.MATERIAL_ID
           AND m.LANGUAGE_ID = 'E'
        WHERE adp.MOVEMENT_TYPE = '261'
          AND adp.UOM != 'EA'
          {date_clause}
        ORDER BY adp.DATE_TIME_OF_ENTRY
    """
    return await run_sql_async(token, query, params, endpoint_hint="poh.pours.events_range")


async def _q_daily30d(token: str) -> list[dict]:
    """Daily pour count over the last 30 days (always fixed; feeds the context chart)."""
    query = f"""
        SELECT
            CAST(UNIX_TIMESTAMP(DATE_TRUNC('day', adp.DATE_TIME_OF_ENTRY)) * 1000 AS BIGINT)
                AS day_ms,
            'ALL'    AS line_id,
            COUNT(*) AS pour_count
        FROM {tbl('vw_gold_adp_movement')} adp
        WHERE adp.MOVEMENT_TYPE = '261'
          AND adp.UOM != 'EA'
          AND adp.DATE_TIME_OF_ENTRY >= current_timestamp() - INTERVAL 30 DAYS
        GROUP BY day_ms
        ORDER BY day_ms
    """
    return await run_sql_async(token, query, endpoint_hint="poh.pours.daily30d")


async def _q_hourly24h(token: str) -> list[dict]:
    """Hourly pour count over the last 24 hours (always fixed; feeds the context chart)."""
    query = f"""
        SELECT
            CAST(UNIX_TIMESTAMP(DATE_TRUNC('hour', adp.DATE_TIME_OF_ENTRY)) * 1000 AS BIGINT)
                AS hour_ms,
            'ALL'    AS line_id,
            COUNT(*) AS pour_count
        FROM {tbl('vw_gold_adp_movement')} adp
        WHERE adp.MOVEMENT_TYPE = '261'
          AND adp.UOM != 'EA'
          AND adp.DATE_TIME_OF_ENTRY >= current_timestamp() - INTERVAL 24 HOURS
        GROUP BY hour_ms
        ORDER BY hour_ms
    """
    return await run_sql_async(token, query, endpoint_hint="poh.pours.hourly24h")


async def _q_prior7d_events(
    token: str,
    date_from: Optional[str],
) -> list[dict]:
    """Movement type-261 events for the 7 days immediately prior to date_from.

    Used by the card view to compute per-entity averages over days with activity.
    Returns an empty list when date_from is not supplied (rolling-window mode).
    line_id is hardcoded to 'ALL' — per-line attribution requires silver schema access.
    """
    if not date_from:
        return []

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
            'ALL'                                                               AS line_id
        FROM {tbl('vw_gold_adp_movement')} adp
        LEFT JOIN {tbl('vw_gold_material')} m
            ON m.MATERIAL_ID = adp.MATERIAL_ID
           AND m.LANGUAGE_ID = 'E'
        WHERE adp.MOVEMENT_TYPE = '261'
          AND adp.UOM != 'EA'
          AND DATE(adp.DATE_TIME_OF_ENTRY) >= DATE_ADD(CAST(:date_from AS DATE), -7)
          AND DATE(adp.DATE_TIME_OF_ENTRY) <  CAST(:date_from AS DATE)
        ORDER BY adp.DATE_TIME_OF_ENTRY
    """
    params = [sql_param("date_from", date_from)]
    return await run_sql_async(token, query, params, endpoint_hint="poh.pours.prior7d")


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

    Returns (series_by_line, sorted_line_ids).  'ALL' is excluded from
    sorted_line_ids since it is always present as a synthetic aggregate.
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

    lines = sorted({line for (_, line) in sparse if line != "ALL"})

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

    lines = sorted({line for (_, line) in sparse if line != "ALL"})

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
    """Fetch pour analytics via 3–4 parallel Databricks queries.

    Returns pre-aggregated daily/hourly context series keyed by 'ALL',
    the raw event list for the requested date range (used by the Breakdown), and
    raw events for the 7 days prior to date_from (used for the card view averages).
    If ``date_from`` / ``date_to`` are omitted, events default to the last-24h window
    and prior7d is empty.

    ``planned_24h`` is always ``None`` — planned pour count requires silver schema
    access that is not universally available.  ``lines`` is always ``[]`` for the
    same reason; the frontend always uses the 'ALL' aggregate series.
    """
    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)

    events_rows, daily_rows, hourly_rows, prior7d_rows = await asyncio.gather(
        _q_events_range(token, date_from, date_to),
        _q_daily30d(token),
        _q_hourly24h(token),
        _q_prior7d_events(token, date_from),
    )

    events = [_coerce_event(r) for r in events_rows]
    prior7d = [_coerce_event(r) for r in prior7d_rows]
    daily_series, _ = _build_daily_series(daily_rows, now_ms)
    hourly_series = _build_hourly_series(hourly_rows, now_ms)

    return {
        "now_ms": now_ms,
        "planned_24h": None,
        "lines": [],
        "events": events,
        "prior7d": prior7d,
        "daily30d": daily_series,
        "hourly24h": hourly_series,
    }
