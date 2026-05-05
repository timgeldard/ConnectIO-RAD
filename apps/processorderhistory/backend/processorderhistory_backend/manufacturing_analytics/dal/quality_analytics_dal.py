"""DAL for quality analytics — inspection result aggregations.

Runs 3–4 Databricks queries in parallel (asyncio.gather):
  1. results_range — inspection result rows for the requested date range
  2. daily30d      — daily accepted/rejected counts, last 30 days
  3. hourly24h     — hourly accepted/rejected counts, last 24 hours
  4. prior7d       — result rows for the 7 days before date_from (only when date_from is supplied)

Timestamp strategy: joins through vw_gold_process_order.INSPECTION_LOT_ID →
vw_gold_inspection_usage_decision.USAGE_DECISION_CREATED_DATE (closest available
quality-event timestamp; rows without a usage decision are excluded from
date-filtered queries).

Judgement rule: INSPECTION_RESULT_VALUATION LIKE 'A%' → 'A', else 'R'
(same as order_detail_dal.py).

If ``date_from`` / ``date_to`` are omitted the results_range query falls back to a
24-hour rolling window for backward compatibility, and prior7d is empty.
"""
import asyncio
from datetime import datetime, timezone as dt_timezone
from typing import Optional

from processorderhistory_backend.db import run_sql_async, sql_param, tbl, tz_date, tz_day_ms, tz_hour_ms
from processorderhistory_backend.manufacturing_analytics.domain.series import local_day_buckets, local_hour_buckets


# ---------------------------------------------------------------------------
# Individual query coroutines
# ---------------------------------------------------------------------------

async def _q_results_range(
    token: str,
    date_from: Optional[str],
    date_to: Optional[str],
    plant_id: Optional[str],
    tz: str,
) -> list[dict]:
    """Inspection result rows joined to usage decision, specification, process order, and material.

    Falls back to last-24h window when no dates supplied.
    Rows without a usage decision are excluded (INNER JOIN to ud).
    Date comparisons use the plant's local calendar date (via ``tz``).
    """
    if date_from and date_to:
        date_clause = (
            f"AND {tz_date('ud.USAGE_DECISION_CREATED_DATE', tz)} >= :date_from"
            f" AND {tz_date('ud.USAGE_DECISION_CREATED_DATE', tz)} <= :date_to"
        )
        params: list[dict] = [sql_param("date_from", date_from), sql_param("date_to", date_to)]
    else:
        date_clause = "AND ud.USAGE_DECISION_CREATED_DATE >= current_timestamp() - INTERVAL 24 HOURS"
        params = []

    plant_clause = "AND po.PLANT_ID = :plant_id" if plant_id else ""
    if plant_id:
        params.append(sql_param("plant_id", plant_id))

    final_params = params if params else None

    query = f"""
        SELECT
            ir.PROCESS_ORDER_ID                                                    AS process_order,
            po.INSPECTION_LOT_ID                                                   AS inspection_lot_id,
            po.MATERIAL_ID                                                         AS material_id,
            COALESCE(m.MATERIAL_NAME, po.MATERIAL_ID)                             AS material_name,
            po.PLANT_ID                                                            AS plant_id,
            ir.INSPECTION_CHARACTERISTIC_ID                                        AS characteristic_id,
            COALESCE(spec.MIC_NAME, ir.INSPECTION_CHARACTERISTIC_ID)              AS characteristic_description,
            ir.SAMPLE_ID                                                           AS sample_id,
            spec.TOLERANCE                                                         AS specification,
            ir.QUANTITATIVE_RESULT                                                 AS quantitative_result,
            ir.QUALITATIVE_RESULT                                                  AS qualitative_result,
            spec.UNIT_OF_MEASURE                                                   AS uom,
            CASE WHEN ir.INSPECTION_RESULT_VALUATION LIKE 'A%' THEN 'A'
                 ELSE 'R'
            END                                                                    AS judgement,
            CAST(UNIX_TIMESTAMP(ud.USAGE_DECISION_CREATED_DATE) * 1000 AS BIGINT) AS result_date_ms,
            ud.USAGE_DECISION_CODE                                                 AS usage_decision_code,
            ud.VALUATION_CODE                                                      AS valuation_code,
            ud.QUALITY_SCORE                                                       AS quality_score
        FROM {tbl('vw_gold_inspection_result')} ir
        JOIN {tbl('vw_gold_process_order')} po
            ON po.PROCESS_ORDER_ID = ir.PROCESS_ORDER_ID
        JOIN {tbl('vw_gold_inspection_usage_decision')} ud
            ON ud.INSPECTION_LOT_ID = po.INSPECTION_LOT_ID
        LEFT JOIN {tbl('vw_gold_inspection_specification')} spec
            ON spec.INSPECTION_CHARACTERISTIC_ID = ir.INSPECTION_CHARACTERISTIC_ID
           AND spec.INSPECTION_OPERATION_ID = ir.INSPECTION_OPERATION_ID
        LEFT JOIN {tbl('vw_gold_material')} m
            ON m.MATERIAL_ID = po.MATERIAL_ID
           AND m.LANGUAGE_ID = 'E'
        WHERE 1 = 1
          {date_clause}
          {plant_clause}
        ORDER BY result_date_ms
        LIMIT 50000
    """
    return await run_sql_async(token, query, final_params, endpoint_hint="poh.quality.results_range")


async def _q_daily30d(token: str, plant_id: Optional[str], tz: str) -> list[dict]:
    """Daily accepted/rejected counts over the last 30 days bucketed by local calendar day.

    Day boundaries align to local midnight in ``tz``.
    """
    plant_clause = "AND po.PLANT_ID = :plant_id" if plant_id else ""
    params: Optional[list[dict]] = [sql_param("plant_id", plant_id)] if plant_id else None

    query = f"""
        SELECT
            {tz_day_ms('ud.USAGE_DECISION_CREATED_DATE', tz)} AS day_ms,
            COUNT(CASE WHEN ir.INSPECTION_RESULT_VALUATION LIKE 'A%' THEN 1 END) AS accepted_count,
            COUNT(CASE
                WHEN ir.INSPECTION_RESULT_VALUATION LIKE 'A%' THEN NULL
                ELSE 1
            END) AS rejected_count
        FROM {tbl('vw_gold_inspection_result')} ir
        JOIN {tbl('vw_gold_process_order')} po
            ON po.PROCESS_ORDER_ID = ir.PROCESS_ORDER_ID
        JOIN {tbl('vw_gold_inspection_usage_decision')} ud
            ON ud.INSPECTION_LOT_ID = po.INSPECTION_LOT_ID
        WHERE ud.USAGE_DECISION_CREATED_DATE >= current_timestamp() - INTERVAL 30 DAYS
          {plant_clause}
        GROUP BY day_ms
        ORDER BY day_ms
    """
    return await run_sql_async(token, query, params, endpoint_hint="poh.quality.daily30d")


async def _q_hourly24h(token: str, plant_id: Optional[str], tz: str) -> list[dict]:
    """Hourly accepted/rejected counts over the last 24 hours bucketed by local calendar hour.

    Hour boundaries align to local hour starts in ``tz``.
    """
    plant_clause = "AND po.PLANT_ID = :plant_id" if plant_id else ""
    params: Optional[list[dict]] = [sql_param("plant_id", plant_id)] if plant_id else None

    query = f"""
        SELECT
            {tz_hour_ms('ud.USAGE_DECISION_CREATED_DATE', tz)} AS hour_ms,
            COUNT(CASE WHEN ir.INSPECTION_RESULT_VALUATION LIKE 'A%' THEN 1 END) AS accepted_count,
            COUNT(CASE
                WHEN ir.INSPECTION_RESULT_VALUATION LIKE 'A%' THEN NULL
                ELSE 1
            END) AS rejected_count
        FROM {tbl('vw_gold_inspection_result')} ir
        JOIN {tbl('vw_gold_process_order')} po
            ON po.PROCESS_ORDER_ID = ir.PROCESS_ORDER_ID
        JOIN {tbl('vw_gold_inspection_usage_decision')} ud
            ON ud.INSPECTION_LOT_ID = po.INSPECTION_LOT_ID
        WHERE ud.USAGE_DECISION_CREATED_DATE >= current_timestamp() - INTERVAL 24 HOURS
          {plant_clause}
        GROUP BY hour_ms
        ORDER BY hour_ms
    """
    return await run_sql_async(token, query, params, endpoint_hint="poh.quality.hourly24h")


async def _q_prior7d_results(
    token: str,
    date_from: Optional[str],
    plant_id: Optional[str],
    tz: str,
) -> list[dict]:
    """Result rows for 7 days prior to date_from.

    Used by the card view to compute per-entity averages over the preceding week.
    Returns an empty list when date_from is not supplied (rolling-window mode).
    Date comparisons use the plant's local calendar date (via ``tz``).
    """
    if not date_from:
        return []

    params: list[dict] = [sql_param("date_from", date_from)]
    plant_clause = "AND po.PLANT_ID = :plant_id" if plant_id else ""
    if plant_id:
        params.append(sql_param("plant_id", plant_id))

    query = f"""
        SELECT
            ir.PROCESS_ORDER_ID                                                    AS process_order,
            po.INSPECTION_LOT_ID                                                   AS inspection_lot_id,
            po.MATERIAL_ID                                                         AS material_id,
            COALESCE(m.MATERIAL_NAME, po.MATERIAL_ID)                             AS material_name,
            po.PLANT_ID                                                            AS plant_id,
            ir.INSPECTION_CHARACTERISTIC_ID                                        AS characteristic_id,
            COALESCE(spec.MIC_NAME, ir.INSPECTION_CHARACTERISTIC_ID)              AS characteristic_description,
            ir.SAMPLE_ID                                                           AS sample_id,
            spec.TOLERANCE                                                         AS specification,
            ir.QUANTITATIVE_RESULT                                                 AS quantitative_result,
            ir.QUALITATIVE_RESULT                                                  AS qualitative_result,
            spec.UNIT_OF_MEASURE                                                   AS uom,
            CASE WHEN ir.INSPECTION_RESULT_VALUATION LIKE 'A%' THEN 'A'
                 ELSE 'R'
            END                                                                    AS judgement,
            CAST(UNIX_TIMESTAMP(ud.USAGE_DECISION_CREATED_DATE) * 1000 AS BIGINT) AS result_date_ms,
            ud.USAGE_DECISION_CODE                                                 AS usage_decision_code,
            ud.VALUATION_CODE                                                      AS valuation_code,
            ud.QUALITY_SCORE                                                       AS quality_score
        FROM {tbl('vw_gold_inspection_result')} ir
        JOIN {tbl('vw_gold_process_order')} po
            ON po.PROCESS_ORDER_ID = ir.PROCESS_ORDER_ID
        JOIN {tbl('vw_gold_inspection_usage_decision')} ud
            ON ud.INSPECTION_LOT_ID = po.INSPECTION_LOT_ID
        LEFT JOIN {tbl('vw_gold_inspection_specification')} spec
            ON spec.INSPECTION_CHARACTERISTIC_ID = ir.INSPECTION_CHARACTERISTIC_ID
           AND spec.INSPECTION_OPERATION_ID = ir.INSPECTION_OPERATION_ID
        LEFT JOIN {tbl('vw_gold_material')} m
            ON m.MATERIAL_ID = po.MATERIAL_ID
           AND m.LANGUAGE_ID = 'E'
        WHERE {tz_date('ud.USAGE_DECISION_CREATED_DATE', tz)} >= DATE_ADD(CAST(:date_from AS DATE), -7)
          AND {tz_date('ud.USAGE_DECISION_CREATED_DATE', tz)} <  CAST(:date_from AS DATE)
          {plant_clause}
        ORDER BY result_date_ms
        LIMIT 50000
    """
    return await run_sql_async(token, query, params, endpoint_hint="poh.quality.prior7d")


# ---------------------------------------------------------------------------
# Coerce helpers — convert Databricks string-serialised values to Python types
# ---------------------------------------------------------------------------

def _coerce_row(row: dict) -> dict:
    """Coerce Databricks string-serialised values in a result row."""
    v = row.get("quantitative_result")
    row["quantitative_result"] = float(v) if v is not None else None

    v = row.get("result_date_ms")
    row["result_date_ms"] = int(v) if v is not None else 0

    v = row.get("quality_score")
    row["quality_score"] = float(v) if v is not None else None

    return row


# ---------------------------------------------------------------------------
# Series builders — fill zero-padded 30-day / 24-hour grids
# ---------------------------------------------------------------------------

def _build_daily_series(daily_rows: list[dict], now_ms: int, tz_name: str = "UTC") -> list[dict]:
    """Zero-padded 30-day series of accepted/rejected counts and right-first-time percentage.

    Bucket boundaries align to local midnight in ``tz_name``.
    rft_pct is None for zero-result buckets (no inspections recorded that day).
    """
    day_buckets = local_day_buckets(now_ms, tz_name)

    sparse: dict[int, tuple[int, int]] = {}
    for row in daily_rows:
        d_ms = int(row["day_ms"])
        acc = int(row.get("accepted_count") or 0)
        rej = int(row.get("rejected_count") or 0)
        prev_acc, prev_rej = sparse.get(d_ms, (0, 0))
        sparse[d_ms] = (prev_acc + acc, prev_rej + rej)

    result: list[dict] = []
    for d in day_buckets:
        acc, rej = sparse.get(d, (0, 0))
        total = acc + rej
        rft_pct = round((acc / total) * 100, 1) if total > 0 else None
        result.append({"date": d, "accepted": acc, "rejected": rej, "rft_pct": rft_pct})
    return result


def _build_hourly_series(hourly_rows: list[dict], now_ms: int, tz_name: str = "UTC") -> list[dict]:
    """Zero-padded 24-hour series of accepted/rejected counts and right-first-time percentage.

    Bucket boundaries align to local hour starts in ``tz_name``.
    rft_pct is None for zero-result buckets (no inspections recorded that hour).
    """
    hour_buckets = local_hour_buckets(now_ms, tz_name)

    sparse: dict[int, tuple[int, int]] = {}
    for row in hourly_rows:
        h_ms = int(row["hour_ms"])
        acc = int(row.get("accepted_count") or 0)
        rej = int(row.get("rejected_count") or 0)
        prev_acc, prev_rej = sparse.get(h_ms, (0, 0))
        sparse[h_ms] = (prev_acc + acc, prev_rej + rej)

    result: list[dict] = []
    for h in hour_buckets:
        acc, rej = sparse.get(h, (0, 0))
        total = acc + rej
        rft_pct = round((acc / total) * 100, 1) if total > 0 else None
        result.append({"hour": h, "accepted": acc, "rejected": rej, "rft_pct": rft_pct})
    return result


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def fetch_quality_analytics(
    token: str,
    *,
    plant_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    timezone: str = "UTC",
) -> dict:
    """Fetch quality analytics via 3–4 parallel Databricks queries.

    Returns daily/hourly series, raw rows for the date range, prior-7d rows
    for card-view averages, and distinct material names.  Timestamp is
    USAGE_DECISION_CREATED_DATE — see module docstring.

    ``timezone`` is a validated IANA timezone name (from ``validate_timezone``).
    Day and hour buckets align to local calendar boundaries in that timezone.

    If ``date_from`` / ``date_to`` are omitted, results_range defaults to the
    last-24h window and prior7d is empty.
    """
    now_ms = int(datetime.now(dt_timezone.utc).timestamp() * 1000)

    rows_result, daily_rows, hourly_rows, prior7d_rows = await asyncio.gather(
        _q_results_range(token, date_from, date_to, plant_id, timezone),
        _q_daily30d(token, plant_id, timezone),
        _q_hourly24h(token, plant_id, timezone),
        _q_prior7d_results(token, date_from, plant_id, timezone),
    )

    rows = [_coerce_row(r) for r in rows_result]
    prior7d = [_coerce_row(r) for r in prior7d_rows]
    daily30d = _build_daily_series(daily_rows, now_ms, timezone)
    hourly24h = _build_hourly_series(hourly_rows, now_ms, timezone)

    materials = sorted({r["material_name"] for r in rows if r.get("material_name")})

    return {
        "now_ms": now_ms,
        "materials": materials,
        "rows": rows,
        "prior7d": prior7d,
        "daily30d": daily30d,
        "hourly24h": hourly24h,
    }
