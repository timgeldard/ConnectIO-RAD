"""DAL for yield analytics — process order yield from pre-computed gold MVs.

Runs 3–4 Databricks queries in parallel (asyncio.gather):
  1. orders_range  — per-order yield for the requested date range.
                     Source: ``metric_yield_per_order`` (pre-computed MV).
                     yield_pct = (qty_received_kg / qty_issued_kg) * 100
                     loss_kg   = qty_issued_kg - qty_received_kg
  2. daily30d      — daily avg yield %, last 30 days.
                     Source: ``metric_yield_daily`` (pre-computed MV).
  3. hourly24h     — hourly avg yield %, last 24 hours.
                     Source: ``metric_yield_per_order`` (today's pre-computed rows).
  4. prior7d       — per-order yield for the 7 days before date_from
                     (only when date_from is supplied; used for card-view comparison).

TARGET_YIELD_PCT = 95.0
"""
import asyncio
from datetime import datetime, timezone as dt_timezone
from typing import Optional

from processorderhistory_backend.db import gold_tbl, run_sql_async, sql_param, tz_hour_ms
from processorderhistory_backend.manufacturing_analytics.domain.series import (
    local_day_buckets,
    local_hour_buckets,
    remap_utc_midnight_to_local_day,
)

TARGET_YIELD_PCT = 95.0

# ---------------------------------------------------------------------------
# Individual query coroutines
# ---------------------------------------------------------------------------

async def _q_orders_range(
    token: str,
    date_from: Optional[str],
    date_to: Optional[str],
    plant_id: Optional[str],
) -> list[dict]:
    """Per-order yield for the requested date range from ``metric_yield_per_order``.

    Filters by ``receipt_date`` (DATE column in the MV).  Falls back to a
    24-hour rolling window when no dates are supplied.
    """
    if date_from and date_to:
        date_clause = "AND receipt_date >= :date_from AND receipt_date <= :date_to"
        params: list[dict] = [sql_param("date_from", date_from), sql_param("date_to", date_to)]
    else:
        date_clause = "AND last_receipt_ts >= current_timestamp() - INTERVAL 24 HOURS"
        params = []

    plant_clause = "AND PLANT_ID = :plant_id" if plant_id else ""
    if plant_id:
        params.append(sql_param("plant_id", plant_id))

    query = f"""
        SELECT
            PROCESS_ORDER_ID                                             AS process_order_id,
            MATERIAL_ID                                                  AS material_id,
            material_name,
            PLANT_ID                                                     AS plant_id,
            qty_received_kg,
            qty_issued_kg,
            yield_pct,
            loss_kg,
            CAST(UNIX_TIMESTAMP(last_receipt_ts) * 1000 AS BIGINT)      AS order_date_ms
        FROM {gold_tbl('metric_yield_per_order')}
        WHERE 1 = 1
          {date_clause}
          {plant_clause}
        ORDER BY last_receipt_ts DESC
    """
    return await run_sql_async(token, query, params or None, endpoint_hint="poh.yield.orders_range")


async def _q_daily30d(token: str) -> list[dict]:
    """Daily average yield % over the last 30 days from ``metric_yield_daily``.

    Returns UTC-midnight epoch-ms keys; ``_build_daily_series`` remaps them to
    local-midnight boundaries via ``remap_utc_midnight_to_local_day``.
    """
    query = f"""
        SELECT
            CAST(UNIX_TIMESTAMP(production_date) * 1000 AS BIGINT) AS day_ms,
            avg_yield_pct,
            order_count
        FROM {gold_tbl('metric_yield_daily')}
        WHERE production_date >= current_date() - INTERVAL 30 DAYS
        ORDER BY production_date
    """
    return await run_sql_async(token, query, endpoint_hint="poh.yield.daily30d")


async def _q_hourly24h(token: str, tz: str) -> list[dict]:
    """Hourly average yield % over the last 24 hours from ``metric_yield_per_order``.

    Scans only today's pre-computed rows rather than the full movement table.
    Hour boundaries align to local hour starts in ``tz``.
    """
    query = f"""
        SELECT
            {tz_hour_ms('CAST(last_receipt_ts AS TIMESTAMP)', tz)} AS hour_ms,
            ROUND(AVG(CASE WHEN yield_pct IS NOT NULL THEN yield_pct END), 2) AS avg_yield_pct,
            COUNT(*) AS order_count
        FROM {gold_tbl('metric_yield_per_order')}
        WHERE last_receipt_ts >= current_timestamp() - INTERVAL 24 HOURS
        GROUP BY {tz_hour_ms('CAST(last_receipt_ts AS TIMESTAMP)', tz)}
        ORDER BY hour_ms
    """
    return await run_sql_async(token, query, endpoint_hint="poh.yield.hourly24h")


async def _q_prior7d_orders(
    token: str,
    date_from: Optional[str],
) -> list[dict]:
    """Per-order yield for the 7 days immediately prior to date_from.

    Used by the card view to compute comparison baseline averages.
    Returns an empty list immediately when date_from is not supplied (rolling-window mode).
    No plant_id filter — used for cross-plant comparison baseline only.
    """
    if not date_from:
        return []

    query = f"""
        SELECT
            PROCESS_ORDER_ID                                             AS process_order_id,
            MATERIAL_ID                                                  AS material_id,
            material_name,
            PLANT_ID                                                     AS plant_id,
            qty_received_kg,
            qty_issued_kg,
            yield_pct,
            loss_kg,
            CAST(UNIX_TIMESTAMP(last_receipt_ts) * 1000 AS BIGINT)      AS order_date_ms
        FROM {gold_tbl('metric_yield_per_order')}
        WHERE receipt_date >= DATE_ADD(CAST(:date_from AS DATE), -7)
          AND receipt_date <  CAST(:date_from AS DATE)
    """
    params = [sql_param("date_from", date_from)]
    return await run_sql_async(token, query, params, endpoint_hint="poh.yield.prior7d")


# ---------------------------------------------------------------------------
# Coerce helpers
# ---------------------------------------------------------------------------

def _coerce_order(row: dict) -> dict:
    """Coerce Databricks string-serialised values in an order yield row.

    ``qty_received_kg`` and ``qty_issued_kg`` default to ``0.0`` when None and are
    rounded to 6 decimal places.  ``yield_pct`` and ``loss_kg`` remain ``None``
    when None (no yield computable).  ``order_date_ms`` defaults to ``0`` when None.
    """
    for key in ("qty_received_kg", "qty_issued_kg"):
        v = row.get(key)
        row[key] = round(float(v), 6) if v is not None else 0.0
    for key in ("yield_pct", "loss_kg"):
        v = row.get(key)
        row[key] = float(v) if v is not None else None
    v = row.get("order_date_ms")
    row["order_date_ms"] = int(v) if v is not None else 0
    return row


# ---------------------------------------------------------------------------
# Series builders — fill zero-padded 30-day / 24-hour grids
# ---------------------------------------------------------------------------

def _build_daily_series(daily_rows: list[dict], now_ms: int, tz_name: str = "UTC") -> list[dict]:
    """Build a zero-padded 30-day series of daily average yield percentages.

    ``metric_yield_daily`` emits UTC-midnight keys; ``remap_utc_midnight_to_local_day``
    re-aligns them to local-midnight boundaries so non-UTC timezones match correctly.
    Returns a list of 30 dicts ``{"date": day_ms, "avg_yield_pct": float | None}``.
    """
    day_buckets = local_day_buckets(now_ms, tz_name)

    lookup: dict[int, Optional[float]] = {}
    for row in daily_rows:
        raw_ms = int(row["day_ms"])
        local_ms = remap_utc_midnight_to_local_day(raw_ms, tz_name)
        yp = row.get("avg_yield_pct")
        lookup[local_ms] = float(yp) if yp is not None else None

    return [{"date": d, "avg_yield_pct": lookup.get(d)} for d in day_buckets]


def _build_hourly_series(hourly_rows: list[dict], now_ms: int, tz_name: str = "UTC") -> list[dict]:
    """Build a zero-padded 24-hour series of hourly average yield percentages.

    Bucket boundaries align to local hour starts in ``tz_name``.
    Returns a list of 24 dicts ``{"hour": hour_ms, "avg_yield_pct": float | None}``.
    """
    hour_buckets = local_hour_buckets(now_ms, tz_name)

    lookup: dict[int, Optional[float]] = {
        int(row["hour_ms"]): (float(row["avg_yield_pct"]) if row.get("avg_yield_pct") is not None else None)
        for row in hourly_rows
    }

    return [{"hour": h, "avg_yield_pct": lookup.get(h)} for h in hour_buckets]


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def fetch_yield_analytics(
    token: str,
    *,
    plant_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    timezone: str = "UTC",
) -> dict:
    """Fetch yield analytics via 3–4 parallel Databricks queries.

    Returns per-order yield rows for the requested date range, a zero-padded
    30-day daily series, a zero-padded 24-hour hourly series, and (when
    ``date_from`` is supplied) per-order yield for the 7 prior days used as a
    comparison baseline by the card view.

    If ``date_from`` / ``date_to`` are omitted the orders query defaults to the
    last-24h rolling window and ``prior7d`` is empty.

    Args:
        token: Databricks access token forwarded from the request proxy header.
        plant_id: Optional SAP plant identifier to filter order results.
        date_from: ISO date string (YYYY-MM-DD) for the start of the range.
        date_to: ISO date string (YYYY-MM-DD) for the end of the range.
        timezone: IANA timezone name from ``validate_timezone``.

    Returns:
        Dict with keys: ``now_ms``, ``target_yield_pct``, ``materials``,
        ``orders``, ``prior7d``, ``daily30d``, ``hourly24h``.
    """
    now_ms = int(datetime.now(dt_timezone.utc).timestamp() * 1000)

    orders_rows, daily_rows, hourly_rows, prior7d_rows = await asyncio.gather(
        _q_orders_range(token, date_from, date_to, plant_id),
        _q_daily30d(token),
        _q_hourly24h(token, timezone),
        _q_prior7d_orders(token, date_from),
    )

    orders = [_coerce_order(r) for r in orders_rows]
    prior7d = [_coerce_order(r) for r in prior7d_rows]
    daily_series = _build_daily_series(daily_rows, now_ms, timezone)
    hourly_series = _build_hourly_series(hourly_rows, now_ms, timezone)
    materials = sorted({o["material_name"] for o in orders if o.get("material_name")})

    return {
        "now_ms": now_ms,
        "target_yield_pct": TARGET_YIELD_PCT,
        "materials": materials,
        "orders": orders,
        "prior7d": prior7d,
        "daily30d": daily_series,
        "hourly24h": hourly_series,
    }
