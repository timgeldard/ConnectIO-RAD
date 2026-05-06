"""DAL for downtime and issue analytics — downtime pareto and trends.

Runs 2 Databricks queries in parallel (asyncio.gather):
  1. reasons_range — downtime pareto by reason code and title for the requested date range
  2. daily30d      — daily downtime duration and event counts, last 30 days

If ``date_from`` / ``date_to`` are omitted the reasons_range query falls back to a
24-hour rolling window.
"""
import asyncio
from datetime import datetime, timezone as dt_timezone
from typing import Optional

from processorderhistory_backend.db import run_sql_async, sql_param, tbl, tz_date, tz_day_ms
from processorderhistory_backend.manufacturing_analytics.domain.series import local_day_buckets


# ---------------------------------------------------------------------------
# Individual query coroutines
# ---------------------------------------------------------------------------

async def _q_reasons_range(
    token: str,
    date_from: Optional[str],
    date_to: Optional[str],
    plant_id: Optional[str],
    tz: str,
) -> list[dict]:
    """Downtime aggregated by reason code and issue title over the date range."""
    if date_from and date_to:
        date_clause = (
            f"AND {tz_date('dt.START_TIME', tz)} >= :date_from"
            f" AND {tz_date('dt.START_TIME', tz)} <= :date_to"
        )
        params: list[dict] = [sql_param("date_from", date_from), sql_param("date_to", date_to)]
    else:
        date_clause = "AND dt.START_TIME >= current_timestamp() - INTERVAL 24 HOURS"
        params = []

    plant_clause = "AND gpo.PLANT_ID = :plant_id" if plant_id else ""
    if plant_id:
        params.append(sql_param("plant_id", plant_id))

    final_params = params if params else None

    query = f"""
        SELECT
            dt.REASON_CODE                                                      AS reason_code,
            dt.ISSUE_TITLE                                                      AS issue_title,
            COALESCE(SUM(dt.DURATION), 0)                                       AS duration_s,
            COUNT(*)                                                            AS event_count
        FROM {tbl('vw_gold_downtime_and_issues')} dt
        JOIN {tbl('vw_gold_process_order')} gpo
            ON gpo.PROCESS_ORDER_ID = dt.PROCESS_ORDER_ID
        WHERE 1 = 1
          {date_clause}
          {plant_clause}
        GROUP BY dt.REASON_CODE, dt.ISSUE_TITLE
        ORDER BY duration_s DESC
        LIMIT 1000
    """
    return await run_sql_async(token, query, final_params, endpoint_hint="poh.downtime.reasons")


async def _q_daily30d(token: str, plant_id: Optional[str], tz: str) -> list[dict]:
    """Daily downtime duration and event counts over the last 30 days.

    Bucket boundaries align to local midnight in ``tz``.
    """
    plant_clause = "AND gpo.PLANT_ID = :plant_id" if plant_id else ""
    params: Optional[list[dict]] = [sql_param("plant_id", plant_id)] if plant_id else None

    query = f"""
        SELECT
            {tz_day_ms('dt.START_TIME', tz)} AS day_ms,
            COALESCE(SUM(dt.DURATION), 0)    AS duration_s,
            COUNT(*)                         AS event_count
        FROM {tbl('vw_gold_downtime_and_issues')} dt
        JOIN {tbl('vw_gold_process_order')} gpo
            ON gpo.PROCESS_ORDER_ID = dt.PROCESS_ORDER_ID
        WHERE dt.START_TIME >= current_timestamp() - INTERVAL 30 DAYS
          {plant_clause}
        GROUP BY day_ms
        ORDER BY day_ms
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

    Bucket boundaries align to local midnight in ``tz_name``.
    """
    day_buckets = local_day_buckets(now_ms, tz_name)

    daily_dict: dict[int, dict] = {}
    for r in daily_rows:
        try:
            day_ms_val = int(r.get("day_ms") or 0)
            daily_dict[day_ms_val] = {
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

    Returns the aggregated reasons for the requested period (or 24h rolling window)
    and the 30-day daily padded series.
    """
    now = datetime.now(dt_timezone.utc)
    now_ms = int(now.timestamp() * 1000)

    reasons_rows, daily_rows = await asyncio.gather(
        _q_reasons_range(token, date_from, date_to, plant_id, tz=timezone),
        _q_daily30d(token, plant_id, tz=timezone),
    )

    reasons = [_coerce_reason_row(r) for r in reasons_rows]
    daily30d = _build_daily_series(daily_rows, now_ms, tz_name=timezone)

    return {
        "now_ms": now_ms,
        "reasons": reasons,
        "daily30d": daily30d,
    }
