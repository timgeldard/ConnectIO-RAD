"""DAL for Schedule Adherence analytics — OTIF and quantity variance.

Runs 2 Databricks queries in parallel (asyncio.gather):
  1. adherence_range — Order-level adherence for the requested date range
  2. daily30d       — Daily OTIF rate trend, last 30 days
"""
import asyncio
from datetime import datetime, timedelta, timezone as dt_timezone
from typing import Optional
from zoneinfo import ZoneInfo

from backend.db import run_sql_async, sql_param, tbl, tz_date, tz_day_ms

_MS_PER_DAY = 86_400_000


# ---------------------------------------------------------------------------
# Individual query coroutines
# ---------------------------------------------------------------------------

async def _q_adherence_range(
    token: str,
    date_from: Optional[str],
    date_to: Optional[str],
    plant_id: Optional[str],
    tz: str,
) -> list[dict]:
    """Order-level schedule adherence metrics over the requested date range."""
    if date_from and date_to:
        date_clause = f"AND ACTUAL_END_DATE >= :date_from AND ACTUAL_END_DATE <= :date_to"
        params: list[dict] = [sql_param("date_from", date_from), sql_param("date_to", date_to)]
    else:
        date_clause = "AND ACTUAL_END_DATE >= current_date() - INTERVAL 7 DAYS"
        params = []

    plant_clause = "AND PLANT_ID = :plant_id" if plant_id else ""
    if plant_id:
        params.append(sql_param("plant_id", plant_id))

    query = f"""
        SELECT
            ORDER_ID                                                            AS order_id,
            MATERIAL_ID                                                         AS material_id,
            PRODUCTION_LINE                                                     AS line_id,
            CAST(UNIX_TIMESTAMP(ACTUAL_END_DATE) * 1000 AS BIGINT)             AS end_ms,
            PLANNED_QTY                                                         AS planned_qty,
            CONFIRMED_QTY                                                       AS confirmed_qty,
            IS_ON_TIME                                                          AS is_on_time,
            IS_IN_FULL                                                          AS is_in_full,
            IS_OTIF                                                             AS is_otif,
            DELAY_DAYS                                                          AS delay_days,
            QTY_VARIANCE_PCT                                                    AS qty_variance_pct
        FROM {tbl('metric_schedule_adherence')}
        WHERE 1=1
          {date_clause}
          {plant_clause}
        ORDER BY ACTUAL_END_DATE DESC
        LIMIT 5000
    """
    return await run_sql_async(token, query, params or None, endpoint_hint="poh.adherence.range")


async def _q_daily30d(token: str, plant_id: Optional[str]) -> list[dict]:
    """Daily OTIF rate trend over the last 30 days."""
    plant_clause = "AND PLANT_ID = :plant_id" if plant_id else ""
    params: Optional[list[dict]] = [sql_param("plant_id", plant_id)] if plant_id else None

    # OTIF rate = SUM(IS_OTIF::INT) / COUNT(*) * 100
    query = f"""
        SELECT
            CAST(UNIX_TIMESTAMP(ACTUAL_END_DATE) * 1000 AS BIGINT)              AS day_ms,
            ROUND(SUM(CAST(IS_ON_TIME AS INT)) * 100.0 / COUNT(*), 1)          AS on_time_pct,
            ROUND(SUM(CAST(IS_IN_FULL AS INT)) * 100.0 / COUNT(*), 1)          AS in_full_pct,
            ROUND(SUM(CAST(IS_OTIF AS INT)) * 100.0 / COUNT(*), 1)             AS otif_pct,
            COUNT(*)                                                            AS order_count
        FROM {tbl('metric_schedule_adherence')}
        WHERE ACTUAL_END_DATE >= current_date() - INTERVAL 30 DAYS
          {plant_clause}
        GROUP BY ACTUAL_END_DATE
        ORDER BY ACTUAL_END_DATE
    """
    return await run_sql_async(token, query, params, endpoint_hint="poh.adherence.daily30d")


# ---------------------------------------------------------------------------
# Coerce helpers
# ---------------------------------------------------------------------------

def _coerce_adherence_row(row: dict) -> dict:
    """Coerce Databricks string-serialised values in an adherence row."""
    for key in ("planned_qty", "confirmed_qty", "qty_variance_pct"):
        v = row.get(key)
        row[key] = float(v) if v is not None else 0.0
    
    for key in ("is_on_time", "is_in_full", "is_otif"):
        v = row.get(key)
        row[key] = str(v).lower() == 'true' if v is not None else False
        
    v = row.get("delay_days")
    row["delay_days"] = int(v) if v is not None else 0
    
    v = row.get("end_ms")
    row["end_ms"] = int(v) if v is not None else 0
    
    return row


# ---------------------------------------------------------------------------
# Series builders
# ---------------------------------------------------------------------------

def _build_daily_series(daily_rows: list[dict], now_ms: int, tz_name: str = "UTC") -> list[dict]:
    """Zero-padded 30-day adherence trend series."""
    tz = ZoneInfo(tz_name)
    now_utc = datetime.fromtimestamp(now_ms / 1000, tz=dt_timezone.utc)
    local_today = now_utc.astimezone(tz).replace(hour=0, minute=0, second=0, microsecond=0)
    day_buckets = [
        int((local_today - timedelta(days=29 - i)).astimezone(dt_timezone.utc).timestamp() * 1000)
        for i in range(30)
    ]

    daily_dict: dict[int, dict] = {}
    for r in daily_rows:
        try:
            d_ms = int(r.get("day_ms") or 0)
            daily_dict[d_ms] = {
                "otif_pct": float(r.get("otif_pct") or 0.0),
                "on_time_pct": float(r.get("on_time_pct") or 0.0),
                "in_full_pct": float(r.get("in_full_pct") or 0.0),
                "order_count": int(r.get("order_count") or 0),
            }
        except (TypeError, ValueError):
            continue

    series = []
    for day_start_ms in day_buckets:
        entry = daily_dict.get(day_start_ms, {"otif_pct": 0.0, "on_time_pct": 0.0, "in_full_pct": 0.0, "order_count": 0})
        series.append({"date": day_start_ms, **entry})
    return series


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def fetch_adherence_analytics(
    token: str,
    *,
    plant_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    timezone: str = "UTC",
) -> dict:
    """Fetch schedule adherence analytics via 2 parallel Databricks queries."""
    now = datetime.now(dt_timezone.utc)
    now_ms = int(now.timestamp() * 1000)

    order_rows, daily_rows = await asyncio.gather(
        _q_adherence_range(token, date_from, date_to, plant_id, tz=timezone),
        _q_daily30d(token, plant_id),
    )

    orders = [_coerce_adherence_row(r) for r in order_rows]
    daily30d = _build_daily_series(daily_rows, now_ms, tz_name=timezone)

    return {
        "now_ms": now_ms,
        "orders": orders,
        "daily30d": daily30d,
    }
