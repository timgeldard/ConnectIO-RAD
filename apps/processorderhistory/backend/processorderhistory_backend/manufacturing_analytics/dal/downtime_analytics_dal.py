"""DAL for downtime and issue analytics — downtime pareto and trends.

Runs 2 Databricks queries in parallel (asyncio.gather):
  1. reasons_range — downtime pareto by reason code and title for the requested date range.
                     Source: ``metric_downtime_daily`` (pre-computed MV).
                     Filters by ``downtime_date`` (DATE column).
  2. daily30d      — daily downtime duration and event counts, last 30 days.
                     Source: ``metric_downtime_daily``.

If ``date_from`` / ``date_to`` are omitted the reasons_range query falls back to a
rolling window covering yesterday and today (``downtime_date >= current_date() - INTERVAL 1 DAY``).
"""
import asyncio
from datetime import datetime, timezone as dt_timezone
from typing import Optional

from processorderhistory_backend.db import gold_tbl, run_sql_async, sql_param
from processorderhistory_backend.manufacturing_analytics.domain.series import (
    local_day_buckets,
    remap_utc_midnight_to_local_day,
)


# ---------------------------------------------------------------------------
# Individual query coroutines
# ---------------------------------------------------------------------------

async def _q_reasons_range(
    token: str,
    date_from: Optional[str],
    date_to: Optional[str],
    plant_id: Optional[str],
) -> list[dict]:
    """Downtime aggregated by reason code and issue title over the date range.

    Filters by ``downtime_date`` (DATE column in the MV).  Falls back to a
    rolling window covering yesterday and today when no dates are supplied.
    """
    if date_from and date_to:
        date_clause = "AND downtime_date >= :date_from AND downtime_date <= :date_to"
        params: list[dict] = [sql_param("date_from", date_from), sql_param("date_to", date_to)]
    else:
        date_clause = "AND downtime_date >= current_date() - INTERVAL 1 DAY"
        params = []

    plant_clause = "AND PLANT_ID = :plant_id" if plant_id else ""
    if plant_id:
        params.append(sql_param("plant_id", plant_id))

    final_params = params if params else None

    query = f"""
        SELECT
            REASON_CODE                  AS reason_code,
            ISSUE_TITLE                  AS issue_title,
            SUM(total_duration_s)        AS duration_s,
            SUM(event_count)             AS event_count
        FROM {gold_tbl('metric_downtime_daily')}
        WHERE 1 = 1
          {date_clause}
          {plant_clause}
        GROUP BY REASON_CODE, ISSUE_TITLE
        ORDER BY duration_s DESC
        LIMIT 1000
    """
    return await run_sql_async(token, query, final_params, endpoint_hint="poh.downtime.reasons")


async def _q_daily30d(token: str, plant_id: Optional[str]) -> list[dict]:
    """Daily downtime duration and event counts over the last 30 days.

    Source: ``metric_downtime_daily``.  Returns UTC-midnight epoch-ms keys;
    ``_build_daily_series`` remaps them to local-midnight boundaries.
    """
    plant_clause = "AND PLANT_ID = :plant_id" if plant_id else ""
    params: Optional[list[dict]] = [sql_param("plant_id", plant_id)] if plant_id else None

    query = f"""
        SELECT
            CAST(UNIX_TIMESTAMP(downtime_date) * 1000 AS BIGINT) AS day_ms,
            SUM(total_duration_s)                                 AS duration_s,
            SUM(event_count)                                      AS event_count
        FROM {gold_tbl('metric_downtime_daily')}
        WHERE downtime_date >= current_date() - INTERVAL 30 DAYS
          {plant_clause}
        GROUP BY downtime_date
        ORDER BY downtime_date
    """
    return await run_sql_async(token, query, params, endpoint_hint="poh.downtime.daily30d")


# ---------------------------------------------------------------------------
# Coerce helpers
# ---------------------------------------------------------------------------

def _coerce_reason_row(row: dict) -> dict:
    """Coerce Databricks string-serialised values in a reason row."""
    v = row.get("duration_s")
    row["duration_s"] = float(v) if v is not None else 0.0

    v = row.get("event_count")
    row["event_count"] = int(v) if v is not None else 0

    return row


# ---------------------------------------------------------------------------
# Series builders — fill zero-padded 30-day grid
# ---------------------------------------------------------------------------

def _build_daily_series(daily_rows: list[dict], now_ms: int, tz_name: str = "UTC") -> list[dict]:
    """Zero-padded 30-day series of downtime duration and event counts.

    ``metric_downtime_daily`` emits UTC-midnight DATE keys; ``remap_utc_midnight_to_local_day``
    re-aligns them to local-midnight boundaries so non-UTC timezones match correctly.
    """
    day_buckets = local_day_buckets(now_ms, tz_name)

    daily_dict: dict[int, dict] = {}
    for r in daily_rows:
        try:
            raw_ms = int(r.get("day_ms") or 0)
            local_ms = remap_utc_midnight_to_local_day(raw_ms, tz_name)
            daily_dict[local_ms] = {
                "duration_s": float(r.get("duration_s") or 0.0),
                "event_count": int(r.get("event_count") or 0),
            }
        except (TypeError, ValueError):
            continue

    series = []
    for day_start_ms in day_buckets:
        entry = daily_dict.get(day_start_ms, {"duration_s": 0.0, "event_count": 0})
        series.append({
            "date": day_start_ms,
            "duration_s": entry["duration_s"],
            "event_count": entry["event_count"],
        })
    return series


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def fetch_downtime_analytics(
    token: str,
    *,
    plant_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    timezone: str = "UTC",
) -> dict:
    """Fetch downtime pareto analytics via 2 parallel Databricks queries.

    Returns the aggregated reasons for the requested period (or rolling-window
    fallback) and the 30-day daily padded series.

    Args:
        token: Databricks access token forwarded from the request proxy header.
        plant_id: Optional SAP plant identifier to filter results.
        date_from: ISO date string (YYYY-MM-DD) for the start of the range.
        date_to: ISO date string (YYYY-MM-DD) for the end of the range.
        timezone: IANA timezone name from ``validate_timezone``.
    """
    now = datetime.now(dt_timezone.utc)
    now_ms = int(now.timestamp() * 1000)

    reasons_rows, daily_rows = await asyncio.gather(
        _q_reasons_range(token, date_from, date_to, plant_id),
        _q_daily30d(token, plant_id),
    )

    reasons = [_coerce_reason_row(r) for r in reasons_rows]
    daily30d = _build_daily_series(daily_rows, now_ms, tz_name=timezone)

    return {
        "now_ms": now_ms,
        "reasons": reasons,
        "daily30d": daily30d,
    }
