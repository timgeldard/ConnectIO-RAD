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
from datetime import datetime, timedelta, timezone as dt_timezone
from typing import Optional
from zoneinfo import ZoneInfo

from backend.db import run_sql_async, sql_param, tbl, tz_date, tz_day_ms, tz_hour_ms

_MS_PER_HOUR = 3_600_000
_MS_PER_DAY = 86_400_000


# ---------------------------------------------------------------------------
# Individual query coroutines
# ---------------------------------------------------------------------------

async def _q_events_range(
    token: str,
    date_from: Optional[str],
    date_to: Optional[str],
    plant_id: Optional[str],
    tz: str,
) -> list[dict]:
    """Movement type-261 events for the requested date range, including process order and operator.

    Falls back to the last-24h rolling window when no dates are supplied.
    Date comparisons use the plant's local calendar date (via ``tz``).
    line_id is hardcoded to 'ALL' — per-line attribution requires silver schema access.
    """
    if date_from and date_to:
        date_clause = (
            f"AND {tz_date('adp.DATE_TIME_OF_ENTRY', tz)} >= :date_from"
            f" AND {tz_date('adp.DATE_TIME_OF_ENTRY', tz)} <= :date_to"
        )
        params = [sql_param("date_from", date_from), sql_param("date_to", date_to)]
    else:
        date_clause = "AND adp.DATE_TIME_OF_ENTRY >= current_timestamp() - INTERVAL 24 HOURS"
        params = []

    plant_clause = "AND po.PLANT_ID = :plant_id" if plant_id else ""
    if plant_id:
        params.append(sql_param("plant_id", plant_id))

    final_params = params if params else None

    query = f"""
        SELECT
            adp.PROCESS_ORDER_ID                                               AS process_order,
            COALESCE(m.MATERIAL_NAME, adp.MATERIAL_ID)                        AS material_name,
            (CASE WHEN adp.MOVEMENT_TYPE = '261' THEN 1 ELSE -1 END) *
            (CASE WHEN UPPER(TRIM(adp.UOM)) = 'G'
                 THEN adp.QUANTITY / 1000.0
                 WHEN UPPER(TRIM(adp.UOM)) = 'EA'
                 THEN 0
                 ELSE adp.QUANTITY END)                                         AS quantity,
            adp.UOM                                                            AS uom,
            adp.STORAGE_ID                                                     AS source_area,
            adp.SOURCE_ST                                                      AS source_type,
            adp.`USER`                                                         AS operator,
            CAST(UNIX_TIMESTAMP(adp.DATE_TIME_OF_ENTRY) * 1000 AS BIGINT)     AS ts_ms,
            'ALL'                                                               AS line_id
        FROM {tbl('vw_gold_adp_movement')} adp
        JOIN {tbl('vw_gold_process_order')} po
            ON po.PROCESS_ORDER_ID = adp.PROCESS_ORDER_ID
        LEFT JOIN {tbl('vw_gold_material')} m
            ON m.MATERIAL_ID = adp.MATERIAL_ID
           AND m.LANGUAGE_ID = 'E'
        WHERE adp.MOVEMENT_TYPE IN ('261', '262')
          AND UPPER(TRIM(adp.UOM)) != 'EA'
          {date_clause}
          {plant_clause}
        ORDER BY adp.DATE_TIME_OF_ENTRY
        LIMIT 50000
    """
    return await run_sql_async(token, query, final_params, endpoint_hint="poh.pours.events_range")


async def _q_daily30d(token: str, plant_id: Optional[str], tz: str) -> list[dict]:
    """Net daily pour count over the last 30 days bucketed by local calendar day.

    MT-261 events count +1; MT-262 reversals count -1 to give the net pour count.
    Day boundaries align to local midnight in ``tz``.
    """
    plant_clause = "AND po.PLANT_ID = :plant_id" if plant_id else ""
    params: Optional[list[dict]] = [sql_param("plant_id", plant_id)] if plant_id else None

    query = f"""
        SELECT
            {tz_day_ms('adp.DATE_TIME_OF_ENTRY', tz)} AS day_ms,
            'ALL'    AS line_id,
            SUM(CASE WHEN adp.MOVEMENT_TYPE = '261' THEN 1
                     WHEN adp.MOVEMENT_TYPE = '262' THEN -1
                     ELSE 0 END) AS pour_count
        FROM {tbl('vw_gold_adp_movement')} adp
        JOIN {tbl('vw_gold_process_order')} po
            ON po.PROCESS_ORDER_ID = adp.PROCESS_ORDER_ID
        WHERE adp.MOVEMENT_TYPE IN ('261', '262')
          AND UPPER(TRIM(adp.UOM)) != 'EA'
          AND adp.DATE_TIME_OF_ENTRY >= current_timestamp() - INTERVAL 30 DAYS
          {plant_clause}
        GROUP BY day_ms
        ORDER BY day_ms
    """
    return await run_sql_async(token, query, params, endpoint_hint="poh.pours.daily30d")


async def _q_hourly24h(token: str, plant_id: Optional[str], tz: str) -> list[dict]:
    """Net hourly pour count over the last 24 hours bucketed by local calendar hour.

    MT-261 events count +1; MT-262 reversals count -1 to give the net pour count.
    Hour boundaries align to local hour starts in ``tz``.
    """
    plant_clause = "AND po.PLANT_ID = :plant_id" if plant_id else ""
    params: Optional[list[dict]] = [sql_param("plant_id", plant_id)] if plant_id else None

    query = f"""
        SELECT
            {tz_hour_ms('adp.DATE_TIME_OF_ENTRY', tz)} AS hour_ms,
            'ALL'    AS line_id,
            SUM(CASE WHEN adp.MOVEMENT_TYPE = '261' THEN 1
                     WHEN adp.MOVEMENT_TYPE = '262' THEN -1
                     ELSE 0 END) AS pour_count
        FROM {tbl('vw_gold_adp_movement')} adp
        JOIN {tbl('vw_gold_process_order')} po
            ON po.PROCESS_ORDER_ID = adp.PROCESS_ORDER_ID
        WHERE adp.MOVEMENT_TYPE IN ('261', '262')
          AND UPPER(TRIM(adp.UOM)) != 'EA'
          AND adp.DATE_TIME_OF_ENTRY >= current_timestamp() - INTERVAL 24 HOURS
          {plant_clause}
        GROUP BY hour_ms
        ORDER BY hour_ms
    """
    return await run_sql_async(token, query, params, endpoint_hint="poh.pours.hourly24h")


async def _q_prior7d_events(
    token: str,
    date_from: Optional[str],
    plant_id: Optional[str],
    tz: str,
) -> list[dict]:
    """Movement type-261 events for the 7 days immediately prior to date_from.

    Used by the card view to compute per-entity averages over days with activity.
    Returns an empty list when date_from is not supplied (rolling-window mode).
    Date comparisons use the plant's local calendar date (via ``tz``).
    line_id is hardcoded to 'ALL' — per-line attribution requires silver schema access.
    """
    if not date_from:
        return []

    plant_clause = "AND po.PLANT_ID = :plant_id" if plant_id else ""
    params = [sql_param("date_from", date_from)]
    if plant_id:
        params.append(sql_param("plant_id", plant_id))

    query = f"""
        SELECT
            adp.PROCESS_ORDER_ID                                               AS process_order,
            COALESCE(m.MATERIAL_NAME, adp.MATERIAL_ID)                        AS material_name,
            (CASE WHEN adp.MOVEMENT_TYPE = '261' THEN 1 ELSE -1 END) *
            (CASE WHEN UPPER(TRIM(adp.UOM)) = 'G'
                 THEN adp.QUANTITY / 1000.0
                 WHEN UPPER(TRIM(adp.UOM)) = 'EA'
                 THEN 0
                 ELSE adp.QUANTITY END)                                         AS quantity,
            adp.UOM                                                            AS uom,
            adp.STORAGE_ID                                                     AS source_area,
            adp.SOURCE_ST                                                      AS source_type,
            adp.`USER`                                                         AS operator,
            CAST(UNIX_TIMESTAMP(adp.DATE_TIME_OF_ENTRY) * 1000 AS BIGINT)     AS ts_ms,
            'ALL'                                                               AS line_id
        FROM {tbl('vw_gold_adp_movement')} adp
        JOIN {tbl('vw_gold_process_order')} po
            ON po.PROCESS_ORDER_ID = adp.PROCESS_ORDER_ID
        LEFT JOIN {tbl('vw_gold_material')} m
            ON m.MATERIAL_ID = adp.MATERIAL_ID
           AND m.LANGUAGE_ID = 'E'
        WHERE adp.MOVEMENT_TYPE IN ('261', '262')
          AND UPPER(TRIM(adp.UOM)) != 'EA'
          AND {tz_date('adp.DATE_TIME_OF_ENTRY', tz)} >= DATE_ADD(CAST(:date_from AS DATE), -7)
          AND {tz_date('adp.DATE_TIME_OF_ENTRY', tz)} <  CAST(:date_from AS DATE)
          {plant_clause}
        ORDER BY adp.DATE_TIME_OF_ENTRY
        LIMIT 50000
    """
    return await run_sql_async(token, query, params, endpoint_hint="poh.pours.prior7d")


# ---------------------------------------------------------------------------
# Coerce helpers
# ---------------------------------------------------------------------------

def _coerce_event(row: dict) -> dict:
    """Coerce Databricks string-serialised values in an event row.

    Quantity is rounded to 6 decimal places; G→KG conversion is applied in SQL.
    """
    v = row.get("quantity")
    row["quantity"] = round(float(v), 6) if v is not None else 0.0
    v = row.get("ts_ms")
    row["ts_ms"] = int(v) if v is not None else 0
    v = row.get("source_type")
    row["source_type"] = str(v).strip() if v is not None else None
    row["shift"] = None
    return row


# ---------------------------------------------------------------------------
# Series builders — fill zero-padded 30-day / 24-hour grids
# ---------------------------------------------------------------------------

def _build_daily_series(
    daily_rows: list[dict], now_ms: int, tz_name: str = "UTC"
) -> tuple[dict[str, list[dict]], list[str]]:
    """Build zero-padded 30-day series keyed by line_id plus 'ALL'.

    Bucket boundaries align to local midnight in ``tz_name``.
    Returns (series_by_line, sorted_line_ids).  'ALL' is excluded from
    sorted_line_ids since it is always present as a synthetic aggregate.
    """
    tz = ZoneInfo(tz_name)
    now_utc = datetime.fromtimestamp(now_ms / 1000, tz=dt_timezone.utc)
    local_today = now_utc.astimezone(tz).replace(hour=0, minute=0, second=0, microsecond=0)
    day_buckets = [
        int((local_today - timedelta(days=29 - i)).astimezone(dt_timezone.utc).timestamp() * 1000)
        for i in range(30)
    ]

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
    hourly_rows: list[dict], now_ms: int, tz_name: str = "UTC"
) -> dict[str, list[dict]]:
    """Build zero-padded 24-hour series keyed by line_id plus 'ALL'.

    Bucket boundaries align to local hour starts in ``tz_name``.
    Buckets run from 24 hours ago to the most recent completed local hour.
    """
    tz = ZoneInfo(tz_name)
    now_utc = datetime.fromtimestamp(now_ms / 1000, tz=dt_timezone.utc)
    local_now_hour = now_utc.astimezone(tz).replace(minute=0, second=0, microsecond=0)
    hour_buckets = [
        int((local_now_hour - timedelta(hours=24 - i)).astimezone(dt_timezone.utc).timestamp() * 1000)
        for i in range(24)
    ]

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
    timezone: str = "UTC",
) -> dict:
    """Fetch pour analytics via 3–4 parallel Databricks queries.

    Returns pre-aggregated daily/hourly context series keyed by 'ALL',
    the raw event list for the requested date range (used by the Breakdown), and
    raw events for the 7 days prior to date_from (used for the card view averages).
    If ``date_from`` / ``date_to`` are omitted, events default to the last-24h window
    and prior7d is empty.

    ``timezone`` is a validated IANA timezone name (from ``validate_timezone``).
    Day and hour buckets align to local calendar boundaries in that timezone.

    ``planned_24h`` is always ``None`` — planned pour count requires silver schema
    access that is not universally available.  ``lines`` is always ``[]`` for the
    same reason; the frontend always uses the 'ALL' aggregate series.
    """
    now_ms = int(datetime.now(dt_timezone.utc).timestamp() * 1000)

    events_rows, daily_rows, hourly_rows, prior7d_rows = await asyncio.gather(
        _q_events_range(token, date_from, date_to, plant_id, timezone),
        _q_daily30d(token, plant_id, timezone),
        _q_hourly24h(token, plant_id, timezone),
        _q_prior7d_events(token, date_from, plant_id, timezone),
    )

    events = [_coerce_event(r) for r in events_rows]
    prior7d = [_coerce_event(r) for r in prior7d_rows]
    daily_series, _ = _build_daily_series(daily_rows, now_ms, timezone)
    hourly_series = _build_hourly_series(hourly_rows, now_ms, timezone)

    return {
        "now_ms": now_ms,
        "planned_24h": None,
        "lines": [],
        "events": events,
        "prior7d": prior7d,
        "daily30d": daily_series,
        "hourly24h": hourly_series,
    }
