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
from datetime import datetime, timezone as dt_timezone
from typing import Optional

from processorderhistory_backend.db import run_sql_async, sql_param, tbl, tz_date, tz_day_ms, tz_hour_ms
from processorderhistory_backend.manufacturing_analytics.domain.series import local_day_buckets, local_hour_buckets

TARGET_YIELD_PCT = 95.0

# ---------------------------------------------------------------------------
# Individual query coroutines
# ---------------------------------------------------------------------------

async def _q_orders_range(
    token: str,
    date_from: Optional[str],
    date_to: Optional[str],
    plant_id: Optional[str],
    tz: str,
) -> list[dict]:
    """Per-order yield for the requested date range using MT-101 receipts and MT-261 issues.

    Two CTEs — ``receipts`` (MT-101) and ``issues`` (MT-261/262) — are joined on
    PROCESS_ORDER_ID.  Only orders that have at least one MT-101 receipt within
    the date range are returned.  Falls back to a 24-hour rolling window when no
    dates are supplied.  Date comparisons use the plant's local calendar date (via ``tz``).
    """
    if date_from and date_to:
        date_clause = (
            f"AND {tz_date('DATE_TIME_OF_ENTRY', tz)} >= :date_from"
            f" AND {tz_date('DATE_TIME_OF_ENTRY', tz)} <= :date_to"
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
                COALESCE(SUM(CASE
                    WHEN MOVEMENT_TYPE = '101' THEN
                        CASE
                            WHEN UPPER(TRIM(UOM)) = 'EA' THEN 0
                            WHEN UPPER(TRIM(UOM)) = 'G'  THEN QUANTITY / 1000.0
                            ELSE QUANTITY
                        END
                    WHEN MOVEMENT_TYPE = '102' THEN
                        -(CASE
                            WHEN UPPER(TRIM(UOM)) = 'EA' THEN 0
                            WHEN UPPER(TRIM(UOM)) = 'G'  THEN QUANTITY / 1000.0
                            ELSE QUANTITY
                        END)
                END), 0.0)
 AS qty_received_kg,
                MAX(DATE_TIME_OF_ENTRY) AS last_receipt_ts
            FROM {tbl('vw_gold_adp_movement')}
            WHERE MOVEMENT_TYPE IN ('101', '102')
              AND UPPER(TRIM(UOM)) != 'EA'
              {date_clause}
            GROUP BY PROCESS_ORDER_ID
        ),
        issues AS (
            SELECT
                PROCESS_ORDER_ID,
                COALESCE(SUM(CASE
                    WHEN MOVEMENT_TYPE = '261' THEN
                        CASE
                            WHEN UPPER(TRIM(UOM)) = 'EA' THEN 0
                            WHEN UPPER(TRIM(UOM)) = 'G'  THEN QUANTITY / 1000.0
                            ELSE QUANTITY
                        END
                    WHEN MOVEMENT_TYPE = '262' THEN
                        -(CASE
                            WHEN UPPER(TRIM(UOM)) = 'EA' THEN 0
                            WHEN UPPER(TRIM(UOM)) = 'G'  THEN QUANTITY / 1000.0
                            ELSE QUANTITY
                        END)
                END), 0.0)
 AS qty_issued_kg
            FROM {tbl('vw_gold_adp_movement')}
            WHERE MOVEMENT_TYPE IN ('261', '262')
              AND UPPER(TRIM(UOM)) != 'EA'
              {date_clause}
            GROUP BY PROCESS_ORDER_ID
        )
        SELECT
            r.PROCESS_ORDER_ID                                                   AS process_order_id,
            po.MATERIAL_ID                                                       AS material_id,
            COALESCE(m.MATERIAL_NAME, po.MATERIAL_DESCRIPTION, po.MATERIAL_ID)  AS material_name,
            po.PLANT_ID                                                          AS plant_id,
            ROUND(r.qty_received_kg, 6)                                          AS qty_received_kg,
            ROUND(COALESCE(i.qty_issued_kg, 0.0), 6)                             AS qty_issued_kg,
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


async def _q_daily30d(token: str, tz: str) -> list[dict]:
    """Daily average yield % over the last 30 days bucketed by local calendar day.

    Two CTEs aggregate MT-101 receipts and MT-261/262 net issues per order per day.
    The outer query computes avg_yield_pct by summing quantities across orders
    within each local day bucket.  Day boundaries align to local midnight in ``tz``.
    """
    query = f"""
        WITH receipts AS (
            SELECT
                {tz_day_ms('DATE_TIME_OF_ENTRY', tz)} AS day_ms,
                PROCESS_ORDER_ID,
                COALESCE(SUM(CASE
                    WHEN MOVEMENT_TYPE = '101' THEN
                        CASE
                            WHEN UPPER(TRIM(UOM)) = 'EA' THEN 0
                            WHEN UPPER(TRIM(UOM)) = 'G'  THEN QUANTITY / 1000.0
                            ELSE QUANTITY
                        END
                    WHEN MOVEMENT_TYPE = '102' THEN
                        -(CASE
                            WHEN UPPER(TRIM(UOM)) = 'EA' THEN 0
                            WHEN UPPER(TRIM(UOM)) = 'G'  THEN QUANTITY / 1000.0
                            ELSE QUANTITY
                        END)
                END), 0.0)
 AS qty_received
            FROM {tbl('vw_gold_adp_movement')}
            WHERE MOVEMENT_TYPE IN ('101', '102')
              AND UPPER(TRIM(UOM)) != 'EA'
              AND DATE_TIME_OF_ENTRY >= current_timestamp() - INTERVAL 30 DAYS
            GROUP BY day_ms, PROCESS_ORDER_ID
        ),
        issues AS (
            SELECT
                {tz_day_ms('DATE_TIME_OF_ENTRY', tz)} AS day_ms,
                PROCESS_ORDER_ID,
                COALESCE(SUM(CASE
                    WHEN MOVEMENT_TYPE = '261' THEN
                        CASE
                            WHEN UPPER(TRIM(UOM)) = 'EA' THEN 0
                            WHEN UPPER(TRIM(UOM)) = 'G'  THEN QUANTITY / 1000.0
                            ELSE QUANTITY
                        END
                    WHEN MOVEMENT_TYPE = '262' THEN
                        -(CASE
                            WHEN UPPER(TRIM(UOM)) = 'EA' THEN 0
                            WHEN UPPER(TRIM(UOM)) = 'G'  THEN QUANTITY / 1000.0
                            ELSE QUANTITY
                        END)
                END), 0.0)
 AS qty_issued
            FROM {tbl('vw_gold_adp_movement')}
            WHERE MOVEMENT_TYPE IN ('261', '262')
              AND UPPER(TRIM(UOM)) != 'EA'
              AND DATE_TIME_OF_ENTRY >= current_timestamp() - INTERVAL 30 DAYS
            GROUP BY day_ms, PROCESS_ORDER_ID
        )
        SELECT
            r.day_ms,
            CASE WHEN SUM(i.qty_issued) > 0
                 THEN ROUND((SUM(r.qty_received) / SUM(i.qty_issued)) * 100.0, 2)
                 ELSE NULL END AS avg_yield_pct
        FROM receipts r
        LEFT JOIN issues i ON i.PROCESS_ORDER_ID = r.PROCESS_ORDER_ID AND i.day_ms = r.day_ms
        GROUP BY r.day_ms
        ORDER BY r.day_ms
    """
    return await run_sql_async(token, query, endpoint_hint="poh.yield.daily30d")


async def _q_hourly24h(token: str, tz: str) -> list[dict]:
    """Hourly average yield % over the last 24 hours bucketed by local calendar hour.

    Same structure as ``_q_daily30d`` but bucketed by local hour and restricted to the
    last 24-hour rolling window.  Hour boundaries align to local hour starts in ``tz``.
    """
    query = f"""
        WITH receipts AS (
            SELECT
                {tz_hour_ms('DATE_TIME_OF_ENTRY', tz)} AS hour_ms,
                PROCESS_ORDER_ID,
                COALESCE(SUM(CASE
                    WHEN MOVEMENT_TYPE = '101' THEN
                        CASE
                            WHEN UPPER(TRIM(UOM)) = 'EA' THEN 0
                            WHEN UPPER(TRIM(UOM)) = 'G'  THEN QUANTITY / 1000.0
                            ELSE QUANTITY
                        END
                    WHEN MOVEMENT_TYPE = '102' THEN
                        -(CASE
                            WHEN UPPER(TRIM(UOM)) = 'EA' THEN 0
                            WHEN UPPER(TRIM(UOM)) = 'G'  THEN QUANTITY / 1000.0
                            ELSE QUANTITY
                        END)
                END), 0.0)
 AS qty_received
            FROM {tbl('vw_gold_adp_movement')}
            WHERE MOVEMENT_TYPE IN ('101', '102')
              AND UPPER(TRIM(UOM)) != 'EA'
              AND DATE_TIME_OF_ENTRY >= current_timestamp() - INTERVAL 24 HOURS
            GROUP BY hour_ms, PROCESS_ORDER_ID
        ),
        issues AS (
            SELECT
                {tz_hour_ms('DATE_TIME_OF_ENTRY', tz)} AS hour_ms,
                PROCESS_ORDER_ID,
                COALESCE(SUM(CASE
                    WHEN MOVEMENT_TYPE = '261' THEN
                        CASE
                            WHEN UPPER(TRIM(UOM)) = 'EA' THEN 0
                            WHEN UPPER(TRIM(UOM)) = 'G'  THEN QUANTITY / 1000.0
                            ELSE QUANTITY
                        END
                    WHEN MOVEMENT_TYPE = '262' THEN
                        -(CASE
                            WHEN UPPER(TRIM(UOM)) = 'EA' THEN 0
                            WHEN UPPER(TRIM(UOM)) = 'G'  THEN QUANTITY / 1000.0
                            ELSE QUANTITY
                        END)
                END), 0.0)
 AS qty_issued
            FROM {tbl('vw_gold_adp_movement')}
            WHERE MOVEMENT_TYPE IN ('261', '262')
              AND UPPER(TRIM(UOM)) != 'EA'
              AND DATE_TIME_OF_ENTRY >= current_timestamp() - INTERVAL 24 HOURS
            GROUP BY hour_ms, PROCESS_ORDER_ID
        )
        SELECT
            r.hour_ms,
            CASE WHEN SUM(i.qty_issued) > 0
                 THEN ROUND((SUM(r.qty_received) / SUM(i.qty_issued)) * 100.0, 2)
                 ELSE NULL END AS avg_yield_pct
        FROM receipts r
        LEFT JOIN issues i ON i.PROCESS_ORDER_ID = r.PROCESS_ORDER_ID AND i.hour_ms = r.hour_ms
        GROUP BY r.hour_ms
        ORDER BY r.hour_ms
    """
    return await run_sql_async(token, query, endpoint_hint="poh.yield.hourly24h")


async def _q_prior7d_orders(
    token: str,
    date_from: Optional[str],
    tz: str,
) -> list[dict]:
    """Per-order yield for the 7 days immediately prior to date_from.

    Used by the card view to compute comparison baseline averages.
    Returns an empty list immediately when date_from is not supplied (rolling-window mode).
    No plant_id filter — used for cross-plant comparison baseline only.
    Date comparisons use the plant's local calendar date (via ``tz``).
    """
    if not date_from:
        return []

    query = f"""
        WITH receipts AS (
            SELECT
                PROCESS_ORDER_ID,
                COALESCE(SUM(CASE
                    WHEN MOVEMENT_TYPE = '101' THEN
                        CASE
                            WHEN UPPER(TRIM(UOM)) = 'EA' THEN 0
                            WHEN UPPER(TRIM(UOM)) = 'G'  THEN QUANTITY / 1000.0
                            ELSE QUANTITY
                        END
                    WHEN MOVEMENT_TYPE = '102' THEN
                        -(CASE
                            WHEN UPPER(TRIM(UOM)) = 'EA' THEN 0
                            WHEN UPPER(TRIM(UOM)) = 'G'  THEN QUANTITY / 1000.0
                            ELSE QUANTITY
                        END)
                END), 0.0)
 AS qty_received_kg,
                MAX(DATE_TIME_OF_ENTRY) AS last_receipt_ts
            FROM {tbl('vw_gold_adp_movement')}
            WHERE MOVEMENT_TYPE IN ('101', '102')
              AND UPPER(TRIM(UOM)) != 'EA'
              AND {tz_date('DATE_TIME_OF_ENTRY', tz)} >= DATE_ADD(CAST(:date_from AS DATE), -7)
              AND {tz_date('DATE_TIME_OF_ENTRY', tz)} <  CAST(:date_from AS DATE)
            GROUP BY PROCESS_ORDER_ID
        ),
        issues AS (
            SELECT
                PROCESS_ORDER_ID,
                COALESCE(SUM(CASE
                    WHEN MOVEMENT_TYPE = '261' THEN
                        CASE
                            WHEN UPPER(TRIM(UOM)) = 'EA' THEN 0
                            WHEN UPPER(TRIM(UOM)) = 'G'  THEN QUANTITY / 1000.0
                            ELSE QUANTITY
                        END
                    WHEN MOVEMENT_TYPE = '262' THEN
                        -(CASE
                            WHEN UPPER(TRIM(UOM)) = 'EA' THEN 0
                            WHEN UPPER(TRIM(UOM)) = 'G'  THEN QUANTITY / 1000.0
                            ELSE QUANTITY
                        END)
                END), 0.0)
 AS qty_issued_kg
            FROM {tbl('vw_gold_adp_movement')}
            WHERE MOVEMENT_TYPE IN ('261', '262')
              AND UPPER(TRIM(UOM)) != 'EA'
              AND {tz_date('DATE_TIME_OF_ENTRY', tz)} >= DATE_ADD(CAST(:date_from AS DATE), -7)
              AND {tz_date('DATE_TIME_OF_ENTRY', tz)} <  CAST(:date_from AS DATE)
            GROUP BY PROCESS_ORDER_ID
        )
        SELECT
            r.PROCESS_ORDER_ID                                                   AS process_order_id,
            po.MATERIAL_ID                                                       AS material_id,
            COALESCE(m.MATERIAL_NAME, po.MATERIAL_DESCRIPTION, po.MATERIAL_ID)  AS material_name,
            po.PLANT_ID                                                          AS plant_id,
            ROUND(r.qty_received_kg, 6)                                          AS qty_received_kg,
            ROUND(COALESCE(i.qty_issued_kg, 0.0), 6)                             AS qty_issued_kg,
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

    Bucket boundaries align to local midnight in ``tz_name``.
    Returns a list of 30 dicts ``{"date": day_ms, "avg_yield_pct": float | None}``,
    oldest bucket first.  Buckets with no data carry ``None`` for ``avg_yield_pct``.
    """
    day_buckets = local_day_buckets(now_ms, tz_name)

    lookup: dict[int, Optional[float]] = {
        int(row["day_ms"]): (float(row["avg_yield_pct"]) if row["avg_yield_pct"] is not None else None)
        for row in daily_rows
    }

    return [{"date": d, "avg_yield_pct": lookup.get(d)} for d in day_buckets]


def _build_hourly_series(hourly_rows: list[dict], now_ms: int, tz_name: str = "UTC") -> list[dict]:
    """Build a zero-padded 24-hour series of hourly average yield percentages.

    Bucket boundaries align to local hour starts in ``tz_name``.
    Returns a list of 24 dicts ``{"hour": hour_ms, "avg_yield_pct": float | None}``,
    oldest bucket first.  Buckets with no data carry ``None`` for ``avg_yield_pct``.
    """
    hour_buckets = local_hour_buckets(now_ms, tz_name)

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

    Returns:
        Dict with keys: ``now_ms``, ``target_yield_pct``, ``materials``,
        ``orders``, ``prior7d``, ``daily30d``, ``hourly24h``.
    """
    now_ms = int(datetime.now(dt_timezone.utc).timestamp() * 1000)

    orders_rows, daily_rows, hourly_rows, prior7d_rows = await asyncio.gather(
        _q_orders_range(token, date_from, date_to, plant_id, timezone),
        _q_daily30d(token, timezone),
        _q_hourly24h(token, timezone),
        _q_prior7d_orders(token, date_from, timezone),
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
