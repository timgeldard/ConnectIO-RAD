"""DAL for OEE analytics — daily availability, performance, and quality.

Runs 2 Databricks queries in parallel (asyncio.gather):
  1. oee_daily_range — OEE components and weighted average for the requested date range
  2. daily30d       — OEE trend over the last 30 days
"""
import asyncio
from datetime import datetime, timezone as dt_timezone
from typing import Optional

from processorderhistory_backend.db import run_sql_async, sql_param, tbl
from processorderhistory_backend.manufacturing_analytics.domain.series import local_day_buckets, remap_utc_midnight_to_local_day


# ---------------------------------------------------------------------------
# Individual query coroutines
# ---------------------------------------------------------------------------

async def _q_oee_range(
    token: str,
    date_from: Optional[str],
    date_to: Optional[str],
    plant_id: Optional[str],
    tz: str,
) -> list[dict]:
    """Aggregate OEE metrics over the requested date range, grouped by line."""
    if date_from and date_to:
        date_clause = "AND PRODUCTION_DATE >= :date_from AND PRODUCTION_DATE <= :date_to"
        params: list[dict] = [sql_param("date_from", date_from), sql_param("date_to", date_to)]
    else:
        date_clause = "AND PRODUCTION_DATE >= current_date() - INTERVAL 7 DAYS"
        params = []

    plant_clause = "AND PLANT_ID = :plant_id" if plant_id else ""
    if plant_id:
        params.append(sql_param("plant_id", plant_id))

    # Weighted Average OEE = SUM(OEE_PCT * SCHEDULED_MINUTES) / SUM(SCHEDULED_MINUTES)
    query = f"""
        SELECT
            PRODUCTION_LINE                                                     AS line_id,
            SUM(SCHEDULED_MINUTES)                                              AS total_scheduled_m,
            SUM(DOWNTIME_MINUTES)                                               AS total_downtime_m,
            SUM(TOTAL_UNITS_PRODUCED)                                           AS total_units,
            SUM(GOOD_UNITS_PRODUCED)                                            AS good_units,
            ROUND(SUM(OEE_PCT * SCHEDULED_MINUTES) / NULLIF(SUM(SCHEDULED_MINUTES), 0), 2)
                                                                                AS avg_oee_pct,
            ROUND(SUM(AVAILABILITY_PCT * SCHEDULED_MINUTES) / NULLIF(SUM(SCHEDULED_MINUTES), 0), 2)
                                                                                AS avg_availability_pct,
            ROUND(SUM(PERFORMANCE_PCT * SCHEDULED_MINUTES) / NULLIF(SUM(SCHEDULED_MINUTES), 0), 2)
                                                                                AS avg_performance_pct,
            ROUND(SUM(QUALITY_PCT * SCHEDULED_MINUTES) / NULLIF(SUM(SCHEDULED_MINUTES), 0), 2)
                                                                                AS avg_quality_pct
        FROM {tbl('metric_oee_daily')}
        WHERE SCHEDULED_MINUTES > 0
          {date_clause}
          {plant_clause}
        GROUP BY PRODUCTION_LINE
        ORDER BY avg_oee_pct DESC
    """
    return await run_sql_async(token, query, params or None, endpoint_hint="poh.oee.range")


async def _q_daily30d(token: str, plant_id: Optional[str]) -> list[dict]:
    """Daily weighted OEE trend over the last 30 days."""
    plant_clause = "AND PLANT_ID = :plant_id" if plant_id else ""
    params: Optional[list[dict]] = [sql_param("plant_id", plant_id)] if plant_id else None

    query = f"""
        SELECT
            CAST(UNIX_TIMESTAMP(PRODUCTION_DATE) * 1000 AS BIGINT)              AS day_ms,
            ROUND(SUM(OEE_PCT * SCHEDULED_MINUTES) / NULLIF(SUM(SCHEDULED_MINUTES), 0), 2)
                                                                                AS oee_pct,
            ROUND(SUM(AVAILABILITY_PCT * SCHEDULED_MINUTES) / NULLIF(SUM(SCHEDULED_MINUTES), 0), 2)
                                                                                AS availability_pct,
            ROUND(SUM(PERFORMANCE_PCT * SCHEDULED_MINUTES) / NULLIF(SUM(SCHEDULED_MINUTES), 0), 2)
                                                                                AS performance_pct,
            ROUND(SUM(QUALITY_PCT * SCHEDULED_MINUTES) / NULLIF(SUM(SCHEDULED_MINUTES), 0), 2)
                                                                                AS quality_pct
        FROM {tbl('metric_oee_daily')}
        WHERE SCHEDULED_MINUTES > 0
          AND PRODUCTION_DATE >= current_date() - INTERVAL 30 DAYS
          {plant_clause}
        GROUP BY PRODUCTION_DATE
        ORDER BY PRODUCTION_DATE
    """
    return await run_sql_async(token, query, params, endpoint_hint="poh.oee.daily30d")


# ---------------------------------------------------------------------------
# Coerce helpers
# ---------------------------------------------------------------------------

def _coerce_oee_row(row: dict) -> dict:
    """Coerce Databricks string-serialised numerics in an OEE row."""
    for key in ("avg_oee_pct", "avg_availability_pct", "avg_performance_pct", "avg_quality_pct",
                "total_scheduled_m", "total_downtime_m", "total_units", "good_units"):
        v = row.get(key)
        row[key] = float(v) if v is not None else 0.0
    return row


# ---------------------------------------------------------------------------
# Series builders
# ---------------------------------------------------------------------------

def _build_daily_series(daily_rows: list[dict], now_ms: int, tz_name: str = "UTC") -> list[dict]:
    """Zero-padded 30-day OEE trend series."""
    day_buckets = local_day_buckets(now_ms, tz_name)

    daily_dict: dict[int, dict] = {}
    for r in daily_rows:
        try:
            raw_day_ms = int(r.get("day_ms") or 0)
            # Metric views emit date keys at UTC midnight; remap them through the
            # user's timezone so non-UTC local-day buckets still match.
            d_ms = remap_utc_midnight_to_local_day(raw_day_ms, tz_name)
            daily_dict[d_ms] = {
                "oee": float(r.get("oee_pct") or 0.0),
                "availability": float(r.get("availability_pct") or 0.0),
                "performance": float(r.get("performance_pct") or 0.0),
                "quality": float(r.get("quality_pct") or 0.0),
            }
        except (TypeError, ValueError):
            continue

    series = []
    for day_start_ms in day_buckets:
        entry = daily_dict.get(day_start_ms, {"oee": 0.0, "availability": 0.0, "performance": 0.0, "quality": 0.0})
        series.append({"date": day_start_ms, **entry})
    return series


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def fetch_oee_analytics(
    token: str,
    *,
    plant_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    timezone: str = "UTC",
) -> dict:
    """Fetch OEE analytics via 2 parallel Databricks queries."""
    now = datetime.now(dt_timezone.utc)
    now_ms = int(now.timestamp() * 1000)

    oee_rows, daily_rows = await asyncio.gather(
        _q_oee_range(token, date_from, date_to, plant_id, tz=timezone),
        _q_daily30d(token, plant_id),
    )

    lines = [_coerce_oee_row(r) for r in oee_rows]
    daily30d = _build_daily_series(daily_rows, now_ms, tz_name=timezone)

    return {
        "now_ms": now_ms,
        "lines": lines,
        "daily30d": daily30d,
    }
