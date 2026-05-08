"""DAL for quality analytics — inspection result aggregations.

Runs 3–4 Databricks queries in parallel (asyncio.gather):
  1. results_range — inspection result rows for the requested date range.
                     Source: ``vw_gold_quality_result_enriched`` (pre-joined gold view).
                     Filters by ``decision_date`` (DATE column).
  2. daily30d      — daily accepted/rejected counts, last 30 days.
                     Source: ``metric_quality_daily`` (pre-computed MV).
  3. hourly24h     — hourly accepted/rejected counts, last 24 hours.
                     Source: ``vw_gold_quality_result_enriched`` with hour bucketing.
  4. prior7d       — result rows for the 7 days before date_from (only when date_from
                     is supplied; used for card-view comparison).
                     Source: ``vw_gold_quality_result_enriched``.

If ``date_from`` / ``date_to`` are omitted the results_range query falls back to a
24-hour rolling window for backward compatibility, and prior7d is empty.
"""
import asyncio
from datetime import datetime, timezone as dt_timezone
from typing import Optional

from processorderhistory_backend.db import gold_tbl, run_sql_async, sql_param, tbl, tz_hour_ms
from processorderhistory_backend.manufacturing_analytics.domain.series import (
    local_day_buckets,
    local_hour_buckets,
    remap_utc_midnight_to_local_day,
)


# ---------------------------------------------------------------------------
# Individual query coroutines
# ---------------------------------------------------------------------------

async def _q_results_range(
    token: str,
    date_from: Optional[str],
    date_to: Optional[str],
    plant_id: Optional[str],
) -> list[dict]:
    """Inspection result rows from ``vw_gold_quality_result_enriched``.

    Filters by ``decision_date`` (DATE column).  Falls back to last-24h window
    when no dates supplied.
    """
    if date_from and date_to:
        date_clause = "AND decision_date >= :date_from AND decision_date <= :date_to"
        params: list[dict] = [sql_param("date_from", date_from), sql_param("date_to", date_to)]
    else:
        date_clause = "AND decision_ts >= current_timestamp() - INTERVAL 24 HOURS"
        params = []

    plant_clause = "AND PLANT_ID = :plant_id" if plant_id else ""
    if plant_id:
        params.append(sql_param("plant_id", plant_id))

    final_params = params if params else None

    query = f"""
        SELECT
            process_order,
            inspection_lot_id,
            material_id,
            material_name,
            PLANT_ID                                                       AS plant_id,
            characteristic_id,
            characteristic_name                                            AS characteristic_description,
            sample_id,
            specification,
            quantitative_result,
            qualitative_result,
            uom,
            judgement,
            CAST(UNIX_TIMESTAMP(decision_ts) * 1000 AS BIGINT)            AS result_date_ms,
            usage_decision_code,
            valuation_code,
            quality_score
        FROM {tbl('vw_gold_quality_result_enriched')}
        WHERE 1 = 1
          {date_clause}
          {plant_clause}
        ORDER BY decision_ts DESC
        LIMIT 50000
    """
    return await run_sql_async(token, query, final_params, endpoint_hint="poh.quality.results_range")


async def _q_daily30d(token: str, plant_id: Optional[str]) -> list[dict]:
    """Daily accepted/rejected counts over the last 30 days.

    Source: ``metric_quality_daily`` (pre-computed MV).
    Returns UTC-midnight epoch-ms keys; ``_build_daily_series`` remaps them
    to local-midnight boundaries via ``remap_utc_midnight_to_local_day``.
    """
    plant_clause = "AND PLANT_ID = :plant_id" if plant_id else ""
    params: Optional[list[dict]] = [sql_param("plant_id", plant_id)] if plant_id else None

    query = f"""
        SELECT
            CAST(UNIX_TIMESTAMP(decision_date) * 1000 AS BIGINT) AS day_ms,
            SUM(accepted_count)                                   AS accepted_count,
            SUM(rejected_count)                                   AS rejected_count
        FROM {gold_tbl('metric_quality_daily')}
        WHERE decision_date >= current_date() - INTERVAL 30 DAYS
          {plant_clause}
        GROUP BY decision_date
        ORDER BY decision_date
    """
    return await run_sql_async(token, query, params, endpoint_hint="poh.quality.daily30d")


async def _q_hourly24h(token: str, plant_id: Optional[str], tz: str) -> list[dict]:
    """Hourly accepted/rejected counts over the last 24 hours.

    Source: ``vw_gold_quality_result_enriched``.  ``judgement`` column is
    pre-computed ('A' = accepted, any other value = rejected).
    Hour boundaries align to local hour starts in ``tz``.
    """
    plant_clause = "AND PLANT_ID = :plant_id" if plant_id else ""
    params: Optional[list[dict]] = [sql_param("plant_id", plant_id)] if plant_id else None

    query = f"""
        SELECT
            {tz_hour_ms('decision_ts', tz)}                              AS hour_ms,
            SUM(CASE WHEN judgement = 'A' THEN 1 ELSE 0 END)            AS accepted_count,
            SUM(CASE WHEN judgement != 'A' THEN 1 ELSE 0 END)           AS rejected_count
        FROM {tbl('vw_gold_quality_result_enriched')}
        WHERE decision_ts >= current_timestamp() - INTERVAL 24 HOURS
          {plant_clause}
        GROUP BY {tz_hour_ms('decision_ts', tz)}
        ORDER BY hour_ms
    """
    return await run_sql_async(token, query, params, endpoint_hint="poh.quality.hourly24h")


async def _q_prior7d_results(
    token: str,
    date_from: Optional[str],
    plant_id: Optional[str],
) -> list[dict]:
    """Result rows for 7 days prior to date_from from ``vw_gold_quality_result_enriched``.

    Used by the card view to compute per-entity averages over the preceding week.
    Returns an empty list when date_from is not supplied (rolling-window mode).
    """
    if not date_from:
        return []

    params: list[dict] = [sql_param("date_from", date_from)]
    plant_clause = "AND PLANT_ID = :plant_id" if plant_id else ""
    if plant_id:
        params.append(sql_param("plant_id", plant_id))

    query = f"""
        SELECT
            process_order,
            inspection_lot_id,
            material_id,
            material_name,
            PLANT_ID                                                       AS plant_id,
            characteristic_id,
            characteristic_name                                            AS characteristic_description,
            sample_id,
            specification,
            quantitative_result,
            qualitative_result,
            uom,
            judgement,
            CAST(UNIX_TIMESTAMP(decision_ts) * 1000 AS BIGINT)            AS result_date_ms,
            usage_decision_code,
            valuation_code,
            quality_score
        FROM {tbl('vw_gold_quality_result_enriched')}
        WHERE decision_date >= DATE_ADD(CAST(:date_from AS DATE), -7)
          AND decision_date <  CAST(:date_from AS DATE)
          {plant_clause}
        ORDER BY decision_ts
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

    ``metric_quality_daily`` emits UTC-midnight DATE keys; ``remap_utc_midnight_to_local_day``
    re-aligns them to local-midnight boundaries so non-UTC timezones match correctly.
    rft_pct is None for zero-result buckets (no inspections recorded that day).
    """
    day_buckets = local_day_buckets(now_ms, tz_name)

    sparse: dict[int, tuple[int, int]] = {}
    for row in daily_rows:
        raw_ms = int(row["day_ms"])
        local_ms = remap_utc_midnight_to_local_day(raw_ms, tz_name)
        acc = int(row.get("accepted_count") or 0)
        rej = int(row.get("rejected_count") or 0)
        prev_acc, prev_rej = sparse.get(local_ms, (0, 0))
        sparse[local_ms] = (prev_acc + acc, prev_rej + rej)

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
    for card-view averages, and distinct material names.  Timestamp source is
    ``decision_ts`` in ``vw_gold_quality_result_enriched``.

    ``timezone`` is a validated IANA timezone name (from ``validate_timezone``).
    Day buckets align to local-midnight boundaries; hour buckets to local hour starts.

    If ``date_from`` / ``date_to`` are omitted, results_range defaults to the
    last-24h window and prior7d is empty.

    Args:
        token: Databricks access token forwarded from the request proxy header.
        plant_id: Optional SAP plant identifier to filter results.
        date_from: ISO date string (YYYY-MM-DD) for the start of the range.
        date_to: ISO date string (YYYY-MM-DD) for the end of the range.
        timezone: IANA timezone name from ``validate_timezone``.
    """
    now_ms = int(datetime.now(dt_timezone.utc).timestamp() * 1000)

    rows_result, daily_rows, hourly_rows, prior7d_rows = await asyncio.gather(
        _q_results_range(token, date_from, date_to, plant_id),
        _q_daily30d(token, plant_id),
        _q_hourly24h(token, plant_id, timezone),
        _q_prior7d_results(token, date_from, plant_id),
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
