"""DAL for yield analytics — process order yield from goods movements.

Runs 3–4 Databricks queries in parallel (asyncio.gather):
  1. orders_range  — per-order yield for the requested date range.
                     Block start = latest MT-101 receipt timestamp.
                     yield_pct = (qty_received_kg / qty_issued_kg) * 100
                     loss_kg   = qty_issued_kg - qty_received_kg
                     Only orders with at least one MT-101 receipt in range appear.
  2. daily30d      — daily avg yield %, last 30 days (always fixed context chart).
  3. hourly24h     — hourly avg yield %, last 24 hours (always fixed context chart).
  4. prior7d       — per-order yield for the 7 days before date_from
                     (only when date_from is supplied; used for card-view comparison).

Quantity conversion (mirrors existing orders_dal pattern):
  UOM = 'EA' → excluded (filtered out before SUM)
  UOM = 'G'  → QUANTITY / 1000.0  (grams to kilograms)
  otherwise  → QUANTITY as-is (assumed kg)

TARGET_YIELD_PCT = 95.0
"""
import asyncio
from datetime import datetime, timezone
from typing import Optional

from backend.db import run_sql_async, sql_param, tbl

_MS_PER_HOUR = 3_600_000
_MS_PER_DAY  = 86_400_000
TARGET_YIELD_PCT = 95.0

_QTY_EXPR = """COALESCE(SUM(CASE
    WHEN UPPER(TRIM(UOM)) = 'G'  THEN QUANTITY / 1000.0
    ELSE QUANTITY
END), 0.0)"""


# ---------------------------------------------------------------------------
# Individual query coroutines
# ---------------------------------------------------------------------------

async def _q_orders_range(
    token: str,
    date_from: Optional[str],
    date_to: Optional[str],
    plant_id: Optional[str],
) -> list[dict]:
    """Per-order yield for the requested date range using MT-101 receipts and MT-261 issues.

    Two CTEs — ``receipts`` (MT-101) and ``issues`` (MT-261) — are joined on
    PROCESS_ORDER_ID.  Only orders that have at least one MT-101 receipt within
    the date range are returned.  Falls back to a 24-hour rolling window when no
    dates are supplied.
    """
    if date_from and date_to:
        date_clause = (
            "AND DATE(DATE_TIME_OF_ENTRY) >= :date_from"
            " AND DATE(DATE_TIME_OF_ENTRY) <= :date_to"
        )
        params = [sql_param("date_from", date_from), sql_param("date_to", date_to)]
    else:
        date_clause = "AND DATE_TIME_OF_ENTRY >= current_timestamp() - INTERVAL 24 HOURS"
        params = []

    if plant_id:
        plant_clause = "WHERE po.PLANT_ID = :plant_id"
        params.append(sql_param("plant_id", plant_id))
    else:
        plant_clause = ""

    params = params if params else None

    query = f"""
        WITH receipts AS (
            SELECT
                PROCESS_ORDER_ID,
                COALESCE(SUM(CASE WHEN UPPER(TRIM(UOM)) = 'G' THEN QUANTITY / 1000.0 ELSE QUANTITY END), 0.0) AS qty_received_kg,
                MAX(DATE_TIME_OF_ENTRY) AS last_receipt_ts
            FROM {tbl('vw_gold_adp_movement')}
            WHERE MOVEMENT_TYPE = '101'
              AND UPPER(TRIM(UOM)) != 'EA'
              {date_clause}
            GROUP BY PROCESS_ORDER_ID
        ),
        issues AS (
            SELECT
                PROCESS_ORDER_ID,
                COALESCE(SUM(CASE WHEN UPPER(TRIM(UOM)) = 'G' THEN QUANTITY / 1000.0 ELSE QUANTITY END), 0.0) AS qty_issued_kg
            FROM {tbl('vw_gold_adp_movement')}
            WHERE MOVEMENT_TYPE = '261'
              AND UPPER(TRIM(UOM)) != 'EA'
              {date_clause}
            GROUP BY PROCESS_ORDER_ID
        )
        SELECT
            r.PROCESS_ORDER_ID                                                   AS process_order_id,
            po.MATERIAL_ID                                                       AS material_id,
            COALESCE(m.MATERIAL_NAME, po.MATERIAL_DESCRIPTION, po.MATERIAL_ID)  AS material_name,
            po.PLANT_ID                                                          AS plant_id,
            r.qty_received_kg,
            COALESCE(i.qty_issued_kg, 0.0)                                       AS qty_issued_kg,
            CASE WHEN COALESCE(i.qty_issued_kg, 0) > 0
                 THEN ROUND((r.qty_received_kg / i.qty_issued_kg) * 100.0, 2)
                 ELSE NULL END                                                   AS yield_pct,
            CASE WHEN COALESCE(i.qty_issued_kg, 0) > 0
                 THEN ROUND(i.qty_issued_kg - r.qty_received_kg, 3)
                 ELSE NULL END                                                   AS loss_kg,
            CAST(UNIX_TIMESTAMP(r.last_receipt_ts) * 1000 AS BIGINT)            AS order_date_ms
        FROM receipts r
        JOIN {tbl('vw_gold_process_order')} po ON po.PROCESS_ORDER_ID = r.PROCESS_ORDER_ID
        LEFT JOIN {tbl('vw_gold_material')} m ON m.MATERIAL_ID = po.MATERIAL_ID AND m.LANGUAGE_ID = 'E'
        LEFT JOIN issues i ON i.PROCESS_ORDER_ID = r.PROCESS_ORDER_ID
        {plant_clause}
        ORDER BY order_date_ms DESC
    """
    return await run_sql_async(token, query, params, endpoint_hint="poh.yield.orders_range")


async def _q_daily30d(token: str) -> list[dict]:
    """Daily average yield % over the last 30 days (always fixed; feeds the context chart).

    Two CTEs aggregate MT-101 receipts and MT-261 issues per order per day.
    The outer query computes avg_yield_pct by summing quantities across orders
    within each day bucket.
    """
    query = f"""
        WITH receipts AS (
            SELECT
                DATE_TRUNC('day', DATE_TIME_OF_ENTRY) AS day_ts,
                PROCESS_ORDER_ID,
                COALESCE(SUM(CASE WHEN UPPER(TRIM(UOM)) = 'G' THEN QUANTITY / 1000.0 ELSE QUANTITY END), 0.0) AS qty_received
            FROM {tbl('vw_gold_adp_movement')}
            WHERE MOVEMENT_TYPE = '101'
              AND UPPER(TRIM(UOM)) != 'EA'
              AND DATE_TIME_OF_ENTRY >= current_timestamp() - INTERVAL 30 DAYS
            GROUP BY day_ts, PROCESS_ORDER_ID
        ),
        issues AS (
            SELECT
                DATE_TRUNC('day', DATE_TIME_OF_ENTRY) AS day_ts,
                PROCESS_ORDER_ID,
                COALESCE(SUM(CASE WHEN UPPER(TRIM(UOM)) = 'G' THEN QUANTITY / 1000.0 ELSE QUANTITY END), 0.0) AS qty_issued
            FROM {tbl('vw_gold_adp_movement')}
            WHERE MOVEMENT_TYPE = '261'
              AND UPPER(TRIM(UOM)) != 'EA'
              AND DATE_TIME_OF_ENTRY >= current_timestamp() - INTERVAL 30 DAYS
            GROUP BY day_ts, PROCESS_ORDER_ID
        )
        SELECT
            CAST(UNIX_TIMESTAMP(r.day_ts) * 1000 AS BIGINT) AS day_ms,
            CASE WHEN SUM(i.qty_issued) > 0
                 THEN ROUND((SUM(r.qty_received) / SUM(i.qty_issued)) * 100.0, 2)
                 ELSE NULL END AS avg_yield_pct
        FROM receipts r
        LEFT JOIN issues i ON i.PROCESS_ORDER_ID = r.PROCESS_ORDER_ID AND i.day_ts = r.day_ts
        GROUP BY r.day_ts
        ORDER BY day_ms
    """
    return await run_sql_async(token, query, endpoint_hint="poh.yield.daily30d")


async def _q_hourly24h(token: str) -> list[dict]:
    """Hourly average yield % over the last 24 hours (always fixed; feeds the context chart).

    Same structure as ``_q_daily30d`` but bucketed by hour and restricted to the
    last 24-hour rolling window.
    """
    query = f"""
        WITH receipts AS (
            SELECT
                DATE_TRUNC('hour', DATE_TIME_OF_ENTRY) AS hour_ts,
                PROCESS_ORDER_ID,
                COALESCE(SUM(CASE WHEN UPPER(TRIM(UOM)) = 'G' THEN QUANTITY / 1000.0 ELSE QUANTITY END), 0.0) AS qty_received
            FROM {tbl('vw_gold_adp_movement')}
            WHERE MOVEMENT_TYPE = '101'
              AND UPPER(TRIM(UOM)) != 'EA'
              AND DATE_TIME_OF_ENTRY >= current_timestamp() - INTERVAL 24 HOURS
            GROUP BY hour_ts, PROCESS_ORDER_ID
        ),
        issues AS (
            SELECT
                DATE_TRUNC('hour', DATE_TIME_OF_ENTRY) AS hour_ts,
                PROCESS_ORDER_ID,
                COALESCE(SUM(CASE WHEN UPPER(TRIM(UOM)) = 'G' THEN QUANTITY / 1000.0 ELSE QUANTITY END), 0.0) AS qty_issued
            FROM {tbl('vw_gold_adp_movement')}
            WHERE MOVEMENT_TYPE = '261'
              AND UPPER(TRIM(UOM)) != 'EA'
              AND DATE_TIME_OF_ENTRY >= current_timestamp() - INTERVAL 24 HOURS
            GROUP BY hour_ts, PROCESS_ORDER_ID
        )
        SELECT
            CAST(UNIX_TIMESTAMP(r.hour_ts) * 1000 AS BIGINT) AS hour_ms,
            CASE WHEN SUM(i.qty_issued) > 0
                 THEN ROUND((SUM(r.qty_received) / SUM(i.qty_issued)) * 100.0, 2)
                 ELSE NULL END AS avg_yield_pct
        FROM receipts r
        LEFT JOIN issues i ON i.PROCESS_ORDER_ID = r.PROCESS_ORDER_ID AND i.hour_ts = r.hour_ts
        GROUP BY r.hour_ts
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
        WITH receipts AS (
            SELECT
                PROCESS_ORDER_ID,
                COALESCE(SUM(CASE WHEN UPPER(TRIM(UOM)) = 'G' THEN QUANTITY / 1000.0 ELSE QUANTITY END), 0.0) AS qty_received_kg,
                MAX(DATE_TIME_OF_ENTRY) AS last_receipt_ts
            FROM {tbl('vw_gold_adp_movement')}
            WHERE MOVEMENT_TYPE = '101'
              AND UPPER(TRIM(UOM)) != 'EA'
              AND DATE(DATE_TIME_OF_ENTRY) >= DATE_ADD(CAST(:date_from AS DATE), -7)
              AND DATE(DATE_TIME_OF_ENTRY) <  CAST(:date_from AS DATE)
            GROUP BY PROCESS_ORDER_ID
        ),
        issues AS (
            SELECT
                PROCESS_ORDER_ID,
                COALESCE(SUM(CASE WHEN UPPER(TRIM(UOM)) = 'G' THEN QUANTITY / 1000.0 ELSE QUANTITY END), 0.0) AS qty_issued_kg
            FROM {tbl('vw_gold_adp_movement')}
            WHERE MOVEMENT_TYPE = '261'
              AND UPPER(TRIM(UOM)) != 'EA'
              AND DATE(DATE_TIME_OF_ENTRY) >= DATE_ADD(CAST(:date_from AS DATE), -7)
              AND DATE(DATE_TIME_OF_ENTRY) <  CAST(:date_from AS DATE)
            GROUP BY PROCESS_ORDER_ID
        )
        SELECT
            r.PROCESS_ORDER_ID                                                   AS process_order_id,
            po.MATERIAL_ID                                                       AS material_id,
            COALESCE(m.MATERIAL_NAME, po.MATERIAL_DESCRIPTION, po.MATERIAL_ID)  AS material_name,
            po.PLANT_ID                                                          AS plant_id,
            r.qty_received_kg,
            COALESCE(i.qty_issued_kg, 0.0)                                       AS qty_issued_kg,
            CASE WHEN COALESCE(i.qty_issued_kg, 0) > 0
                 THEN ROUND((r.qty_received_kg / i.qty_issued_kg) * 100.0, 2)
                 ELSE NULL END                                                   AS yield_pct,
            CASE WHEN COALESCE(i.qty_issued_kg, 0) > 0
                 THEN ROUND(i.qty_issued_kg - r.qty_received_kg, 3)
                 ELSE NULL END                                                   AS loss_kg,
            CAST(UNIX_TIMESTAMP(r.last_receipt_ts) * 1000 AS BIGINT)            AS order_date_ms
        FROM receipts r
        JOIN {tbl('vw_gold_process_order')} po ON po.PROCESS_ORDER_ID = r.PROCESS_ORDER_ID
        LEFT JOIN {tbl('vw_gold_material')} m ON m.MATERIAL_ID = po.MATERIAL_ID AND m.LANGUAGE_ID = 'E'
        LEFT JOIN issues i ON i.PROCESS_ORDER_ID = r.PROCESS_ORDER_ID
    """
    params = [sql_param("date_from", date_from)]
    return await run_sql_async(token, query, params, endpoint_hint="poh.yield.prior7d")


# ---------------------------------------------------------------------------
# Coerce helpers
# ---------------------------------------------------------------------------

def _coerce_order(row: dict) -> dict:
    """Coerce Databricks string-serialised values in an order yield row.

    ``qty_received_kg`` and ``qty_issued_kg`` default to ``0.0`` when None.
    ``yield_pct`` and ``loss_kg`` remain ``None`` when None (no yield computable).
    ``order_date_ms`` defaults to ``0`` when None.
    """
    for key in ("qty_received_kg", "qty_issued_kg"):
        v = row.get(key)
        row[key] = float(v) if v is not None else 0.0
    for key in ("yield_pct", "loss_kg"):
        v = row.get(key)
        row[key] = float(v) if v is not None else None
    v = row.get("order_date_ms")
    row["order_date_ms"] = int(v) if v is not None else 0
    return row


# ---------------------------------------------------------------------------
# Series builders — fill zero-padded 30-day / 24-hour grids
# ---------------------------------------------------------------------------

def _build_daily_series(daily_rows: list[dict], now_ms: int) -> list[dict]:
    """Build a zero-padded 30-day series of daily average yield percentages.

    Returns a list of 30 dicts ``{"date": day_ms, "avg_yield_pct": float | None}``,
    oldest bucket first.  Buckets with no data carry ``None`` for ``avg_yield_pct``.
    """
    now_day_ms = (now_ms // _MS_PER_DAY) * _MS_PER_DAY
    day_buckets = [now_day_ms - (29 - i) * _MS_PER_DAY for i in range(30)]

    lookup: dict[int, Optional[float]] = {
        int(row["day_ms"]): (float(row["avg_yield_pct"]) if row["avg_yield_pct"] is not None else None)
        for row in daily_rows
    }

    return [{"date": d, "avg_yield_pct": lookup.get(d)} for d in day_buckets]


def _build_hourly_series(hourly_rows: list[dict], now_ms: int) -> list[dict]:
    """Build a zero-padded 24-hour series of hourly average yield percentages.

    Returns a list of 24 dicts ``{"hour": hour_ms, "avg_yield_pct": float | None}``,
    oldest bucket first.  Buckets with no data carry ``None`` for ``avg_yield_pct``.
    """
    now_hour_ms = (now_ms // _MS_PER_HOUR) * _MS_PER_HOUR
    hour_buckets = [now_hour_ms - (24 - i) * _MS_PER_HOUR for i in range(24)]

    lookup: dict[int, Optional[float]] = {
        int(row["hour_ms"]): (float(row["avg_yield_pct"]) if row["avg_yield_pct"] is not None else None)
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

    Returns:
        Dict with keys: ``now_ms``, ``target_yield_pct``, ``materials``,
        ``orders``, ``prior7d``, ``daily30d``, ``hourly24h``.
    """
    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)

    orders_rows, daily_rows, hourly_rows, prior7d_rows = await asyncio.gather(
        _q_orders_range(token, date_from, date_to, plant_id),
        _q_daily30d(token),
        _q_hourly24h(token),
        _q_prior7d_orders(token, date_from),
    )

    orders = [_coerce_order(r) for r in orders_rows]
    prior7d = [_coerce_order(r) for r in prior7d_rows]
    daily_series = _build_daily_series(daily_rows, now_ms)
    hourly_series = _build_hourly_series(hourly_rows, now_ms)
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
