"""SPC chart DAL — async fetch functions for chart pages, normality, control limits,
attribute charts, capability drift, and data-quality summaries.

The helpers used by these fetch functions live in three sibling modules
extracted to keep this file focused on orchestration:

- ``_chart_coercion`` — row-type coercion and USL/LSL derivation.
- ``_chart_cursor``   — cursor encode/decode and batch-sequence stamping.
- ``_chart_filters``  — ``ChartFilterSpec`` plus filter and CTE/SQL builders.

Symbols imported by ``application/`` and tests are re-exported below so callers
can continue to ``from spc_backend.process_control.dal import charts as ...``.
"""
import logging
from typing import Optional

from spc_backend.process_control.dal._chart_coercion import (
    _apply_chart_row_formatting,
)
from spc_backend.process_control.dal._chart_cursor import (
    _assign_batch_sequence,
    decode_chart_cursor,
    encode_chart_cursor,
)
from spc_backend.process_control.dal._chart_filters import (
    ChartFilterSpec,
    _build_chart_filters,
    _build_chart_page_query,
    _build_chart_values_query,
)
from spc_backend.utils.db import TRACE_CATALOG, TRACE_SCHEMA, run_sql_async, sql_param, tbl
from spc_backend.utils.schema_contract import detect_optional_columns

logger = logging.getLogger(__name__)

_NORMALITY_MAX_POINTS = 5000
_FULL_CHART_MAX_ROWS = 10000
_ATTRIBUTE_CHART_MAX_ROWS = 10000


# ---------------------------------------------------------------------------
# Re-exports — kept for backward compatibility with tests / application layer
# that import these names from ``spc_backend.process_control.dal.charts``.
# New code should import from the focused sibling modules above.
# ---------------------------------------------------------------------------
__all__ = [
    # Public cursor API
    "encode_chart_cursor",
    "decode_chart_cursor",
    # Test-visible internals (preserved during the M-5 split)
    "_apply_chart_row_formatting",
    "_build_chart_filters",
    "ChartFilterSpec",
    # Public async fetch surface (defined below)
    "fetch_chart_data_page",
    "fetch_chart_data_values",
    "fetch_normality_summary",
    "fetch_control_limits",
    "fetch_chart_data",
    "fetch_p_chart_data",
    "fetch_count_chart_data",
    "fetch_spec_drift_summary",
    "fetch_data_quality_summary",
]


async def fetch_chart_data_page(
    token: str,
    material_id: str,
    mic_id: str,
    mic_name: Optional[str],
    plant_id: Optional[str],
    date_from: Optional[str],
    date_to: Optional[str],
    stratify_by: Optional[str] = None,
    cursor: Optional[str] = None,
    limit: int = 1000,
    operation_id: Optional[str] = None,
) -> dict:
    filters = _build_chart_filters(
        material_id,
        mic_id,
        mic_name,
        plant_id,
        date_from,
        date_to,
        stratify_by,
        operation_id,
    )
    query, params = _build_chart_page_query(filters, cursor, limit)
    rows = await run_sql_async(token, query, params, endpoint_hint="spc.charts.chart-data")
    has_more = len(rows) > limit
    raw_page_rows = rows[:limit]
    next_cursor = None
    if has_more and raw_page_rows:
        last_row = raw_page_rows[-1]
        next_cursor = encode_chart_cursor(
            int(last_row["cursor_batch_date_epoch"]),
            str(last_row["batch_id"]),
            str(last_row.get("cursor_sample_id") or ""),
            str(last_row.get("cursor_inspection_lot_id") or ""),
            str(last_row.get("cursor_operation_id") or ""),
        )
    page_rows = _apply_chart_row_formatting(raw_page_rows)
    return {
        "data": page_rows,
        "next_cursor": next_cursor,
        "has_more": has_more,
    }


async def fetch_chart_data_values(
    token: str,
    material_id: str,
    mic_id: str,
    mic_name: Optional[str],
    plant_id: Optional[str],
    date_from: Optional[str],
    date_to: Optional[str],
    stratify_by: Optional[str] = None,
    max_points: int = _NORMALITY_MAX_POINTS,
    operation_id: Optional[str] = None,
) -> list[Optional[float]]:
    filters = _build_chart_filters(
        material_id,
        mic_id,
        mic_name,
        plant_id,
        date_from,
        date_to,
        stratify_by,
        operation_id,
    )
    query, params = _build_chart_values_query(filters, max_points)
    rows = await run_sql_async(token, query, params, endpoint_hint="spc.charts.chart-values")
    values = []
    for row in rows:
        value = row.get("value")
        try:
            values.append(float(value) if value is not None else None)
        except (ValueError, TypeError):
            values.append(None)
    return values


async def fetch_normality_summary(
    token: str,
    material_id: str,
    mic_id: str,
    plant_id: Optional[str],
    date_from: Optional[str],
    date_to: Optional[str],
    operation_id: Optional[str] = None,
) -> dict:
    params = [
        sql_param("material_id", material_id),
        sql_param("mic_id", mic_id),
    ]
    clauses = ["material_id = :material_id", "mic_id = :mic_id"]
    if plant_id:
        clauses.append("plant_id = :plant_id")
        params.append(sql_param("plant_id", plant_id))
    if date_from:
        clauses.append("batch_date >= :date_from")
        params.append(sql_param("date_from", date_from))
    if date_to:
        clauses.append("batch_date <= :date_to")
        params.append(sql_param("date_to", date_to))
    if operation_id:
        clauses.append("operation_id = :operation_id")
        params.append(sql_param("operation_id", operation_id))
    where_sql = "WHERE " + " AND ".join(clauses)

    query = f"""
        SELECT
            MEASURE(normality_safe) AS normality_safe,
            MAX(normality_type)     AS normality_type,
            MAX(normality_method)   AS normality_method
        FROM {tbl('spc_quality_metrics')}
        {where_sql}
        GROUP BY mic_id, operation_id
    """
    rows = await run_sql_async(token, query, params, endpoint_hint="spc.charts.normality")
    if not rows:
        return {
            "method": "governed_profile",
            "p_value": None,
            "alpha": 0.05,
            "is_normal": None,
            "warning": "Normality metadata unavailable for this characteristic.",
        }
    if len(rows) > 1:
        logger.warning(
            "spc.normality.ambiguous_operation material_id=%s mic_id=%s plant_id=%s operations=%d",
            material_id,
            mic_id,
            plant_id,
            len(rows),
        )
        return {
            "method": "governed_profile",
            "p_value": None,
            "alpha": 0.05,
            "is_normal": None,
            "warning": "Normality metadata spans multiple operations. Select a routing step to use the governed profile.",
        }

    row = rows[0]
    safe_flag = int(float(row.get("normality_safe") or 0))
    normality_type = str(row.get("normality_type") or "unknown")
    normality_method = str(row.get("normality_method") or "governed_profile")
    is_normal: Optional[bool]
    warning: Optional[str] = None
    if safe_flag != 1:
        is_normal = None
        warning = "Normality classification is mixed across this date range."
    elif normality_type == "normal":
        is_normal = True
    elif normality_type == "non_normal":
        is_normal = False
    else:
        is_normal = None
        warning = "Normality profile is not yet available for this characteristic."

    return {
        "method": normality_method,
        "p_value": None,
        "alpha": 0.05,
        "is_normal": is_normal,
        "warning": warning,
    }


async def fetch_control_limits(
    token: str,
    material_id: str,
    mic_id: str,
    plant_id: Optional[str],
    date_from: Optional[str],
    date_to: Optional[str],
    operation_id: Optional[str] = None,
) -> dict:
    params = [
        sql_param("material_id", material_id),
        sql_param("mic_id", mic_id),
    ]
    clauses = ["material_id = :material_id", "mic_id = :mic_id"]
    if plant_id:
        clauses.append("plant_id = :plant_id")
        params.append(sql_param("plant_id", plant_id))
    if date_from:
        clauses.append("batch_date >= :date_from")
        params.append(sql_param("date_from", date_from))
    if date_to:
        clauses.append("batch_date <= :date_to")
        params.append(sql_param("date_to", date_to))
    if operation_id:
        clauses.append("operation_id = :operation_id")
        params.append(sql_param("operation_id", operation_id))
    where_sql = "WHERE " + " AND ".join(clauses)

    query = f"""
        SELECT
            MEASURE(mean_value)    AS cl,
            MEASURE(x_bar_ucl)     AS ucl,
            MEASURE(x_bar_lcl)     AS lcl,
            MEASURE(sigma_within)  AS sigma_within,
            MEASURE(cpk)           AS cpk,
            MEASURE(ppk)           AS ppk
        FROM {tbl('spc_quality_metrics')}
        {where_sql}
        GROUP BY mic_id, operation_id
    """
    rows = await run_sql_async(token, query, params, endpoint_hint="spc.charts.control-limits")
    if len(rows) > 1:
        logger.warning(
            "spc.control_limits.ambiguous_operation material_id=%s mic_id=%s plant_id=%s operations=%d",
            material_id,
            mic_id,
            plant_id,
            len(rows),
        )
        return {
            "cl": None,
            "ucl": None,
            "lcl": None,
            "sigma_within": None,
            "cpk": None,
            "ppk": None,
        }
    row = rows[0] if rows else {}
    result: dict[str, Optional[float]] = {}
    for key in ("cl", "ucl", "lcl", "sigma_within", "cpk", "ppk"):
        value = row.get(key)
        result[key] = float(value) if value is not None else None
    return result


async def fetch_chart_data(
    token: str,
    material_id: str,
    mic_id: str,
    mic_name: Optional[str],
    plant_id: Optional[str],
    date_from: Optional[str],
    date_to: Optional[str],
    stratify_by: Optional[str] = None,
    max_rows: int = _FULL_CHART_MAX_ROWS,
    operation_id: Optional[str] = None,
) -> list[dict]:
    all_rows: list[dict] = []
    cursor = None
    while len(all_rows) < max_rows:
        remaining = max_rows - len(all_rows)
        page = await fetch_chart_data_page(
            token,
            material_id,
            mic_id,
            mic_name,
            plant_id,
            date_from,
            date_to,
            stratify_by,
            cursor=cursor,
            limit=min(1000, remaining),
            operation_id=operation_id,
        )
        all_rows.extend(page["data"])
        if not page["has_more"]:
            break
        cursor = page["next_cursor"]
    return _assign_batch_sequence(all_rows[:max_rows])


async def fetch_p_chart_data(
    token: str,
    material_id: str,
    mic_id: str,
    mic_name: Optional[str],
    plant_id: Optional[str],
    date_from: Optional[str],
    date_to: Optional[str],
    operation_id: Optional[str] = None,
) -> list[dict]:
    params = [sql_param("material_id", material_id), sql_param("mic_id", mic_id)]
    clauses = ["material_id = :material_id", "mic_id = :mic_id"]
    if date_from:
        clauses.append("batch_date >= :date_from")
        params.append(sql_param("date_from", date_from))
    if date_to:
        clauses.append("batch_date <= :date_to")
        params.append(sql_param("date_to", date_to))
    if plant_id:
        clauses.append("plant_id = :plant_id")
        params.append(sql_param("plant_id", plant_id))
    if operation_id:
        clauses.append("operation_id = :operation_id")
        params.append(sql_param("operation_id", operation_id))
    where_sql = "WHERE " + " AND ".join(clauses)

    query = f"""
        SELECT
            batch_id,
            CAST(batch_date AS STRING)                                            AS batch_date,
            SUM(inspected_count)                                                  AS n_inspected,
            SUM(nonconforming_count)                                              AS n_nonconforming,
            ROUND(SUM(nonconforming_count) / GREATEST(SUM(inspected_count), 1), 4) AS p_value
        FROM {tbl('spc_attribute_subgroup_mv')}
        {where_sql}
        GROUP BY batch_id, batch_date
        ORDER BY COALESCE(batch_date, '9999-12-31'), batch_id
        LIMIT {_ATTRIBUTE_CHART_MAX_ROWS}
    """
    rows = await run_sql_async(token, query, params, endpoint_hint="spc.charts.p-chart")
    rows = _assign_batch_sequence(rows)
    for row in rows:
        row["batch_seq"] = int(float(row.get("batch_seq", 0) or 0))
        row["n_inspected"] = int(float(row.get("n_inspected", 0) or 0))
        row["n_nonconforming"] = int(float(row.get("n_nonconforming", 0) or 0))
        row["p_value"] = float(row.get("p_value", 0) or 0)
    return rows


async def fetch_count_chart_data(
    token: str,
    material_id: str,
    mic_id: str,
    mic_name: Optional[str],
    plant_id: Optional[str],
    date_from: Optional[str],
    date_to: Optional[str],
    chart_subtype: str,
    operation_id: Optional[str] = None,
) -> list[dict]:
    params = [sql_param("material_id", material_id), sql_param("mic_id", mic_id)]
    clauses = ["material_id = :material_id", "mic_id = :mic_id"]
    if date_from:
        clauses.append("batch_date >= :date_from")
        params.append(sql_param("date_from", date_from))
    if date_to:
        clauses.append("batch_date <= :date_to")
        params.append(sql_param("date_to", date_to))
    if plant_id:
        clauses.append("plant_id = :plant_id")
        params.append(sql_param("plant_id", plant_id))
    if operation_id:
        clauses.append("operation_id = :operation_id")
        params.append(sql_param("operation_id", operation_id))
    where_sql = "WHERE " + " AND ".join(clauses)

    query = f"""
        SELECT
            batch_id,
            CAST(batch_date AS STRING)   AS batch_date,
            SUM(inspected_count)         AS n_inspected,
            SUM(nonconforming_count)     AS defect_count
        FROM {tbl('spc_attribute_subgroup_mv')}
        {where_sql}
        GROUP BY batch_id, batch_date
        ORDER BY COALESCE(batch_date, '9999-12-31'), batch_id
        LIMIT {_ATTRIBUTE_CHART_MAX_ROWS}
    """
    rows = await run_sql_async(token, query, params, endpoint_hint="spc.charts.count-chart")
    rows = _assign_batch_sequence(rows)
    for row in rows:
        row["batch_seq"] = int(float(row.get("batch_seq", 0) or 0))
        row["n_inspected"] = int(float(row.get("n_inspected", 0) or 0))
        row["defect_count"] = int(float(row.get("defect_count", 0) or 0))
    return rows


async def fetch_spec_drift_summary(
    token: str,
    material_id: str,
    mic_id: str,
    plant_id: Optional[str],
    date_from: Optional[str],
    date_to: Optional[str],
    operation_id: Optional[str] = None,
) -> dict:
    """Pre-flight spec-drift check.

    Queries spc_quality_metric_subgroup_v for the number of distinct spec_signature
    values observed for this MIC/material/plant in the requested date range.
    A count > 1 means the process was inspected against different tolerance limits
    within the range — mixing them on one SPC chart produces invalid control limits.

    Returns a dict with keys:
        detected (bool), distinct_signatures (int), total_batches (int),
        signature_set (list[str]).
    """
    params: list[dict] = [
        sql_param("material_id", material_id),
        sql_param("mic_id", mic_id),
    ]
    conditions = [
        "material_id = :material_id",
        "mic_id      = :mic_id",
        "subgroup_rep = 1",
    ]
    if plant_id:
        conditions.append("plant_id = :plant_id")
        params.append(sql_param("plant_id", plant_id))
    if date_from:
        conditions.append("batch_date >= :date_from")
        params.append(sql_param("date_from", date_from))
    if date_to:
        conditions.append("batch_date <= :date_to")
        params.append(sql_param("date_to", date_to))
    if operation_id:
        conditions.append("operation_id = :operation_id")
        params.append(sql_param("operation_id", operation_id))

    where_clause = " AND ".join(conditions)
    preferred_query = f"""
        SELECT
            distinct_signatures,
            total_batches,
            signature_set,
            change_references
        FROM {tbl('spc_spec_drift_summary_v')}
        WHERE {where_clause}
    """
    fallback_query = f"""
        SELECT
            COUNT(DISTINCT spec_signature)  AS distinct_signatures,
            COUNT(DISTINCT batch_id)        AS total_batches,
            COLLECT_SET(spec_signature)     AS signature_set,
            CAST(NULL AS ARRAY<STRING>)     AS change_references
        FROM (
            SELECT DISTINCT batch_id, spec_signature
            FROM {tbl('spc_quality_metric_subgroup_v')}
            WHERE {where_clause}
        ) t
    """
    try:
        rows = await run_sql_async(token, preferred_query, params, endpoint_hint="spc.charts.spec-drift")
    except Exception as exc:
        message = str(exc).lower()
        if (
            "table_or_view_not_found" not in message
            and "table or view not found" not in message
            and "does not exist" not in message
            and "doesn't exist" not in message
        ):
            raise
        rows = await run_sql_async(token, fallback_query, params, endpoint_hint="spc.charts.spec-drift")
    row = rows[0] if rows else {}
    distinct = int(float(row.get("distinct_signatures") or 1))
    total = int(float(row.get("total_batches") or 0))
    sig_set = row.get("signature_set") or []
    if isinstance(sig_set, str):
        sig_set = [sig_set]
    change_references = row.get("change_references")
    if isinstance(change_references, str):
        change_references = [change_references]
    return {
        "detected": distinct > 1,
        "distinct_signatures": distinct,
        "total_batches": total,
        "signature_set": list(sig_set),
        "change_references": list(change_references) if isinstance(change_references, list) else None,
    }


async def fetch_data_quality_summary(
    token: str,
    material_id: str,
    mic_id: str,
    plant_id: Optional[str],
    date_from: Optional[str],
    date_to: Optional[str],
    operation_id: Optional[str] = None,
) -> dict:
    """Single-query data-quality summary for the selected MIC/material/plant.

    Returns counts, missing-value rate, 3-sigma outlier count, and time-gap
    statistics between consecutive batches' posting dates. Surfaced by
    /api/spc/data-quality and rendered in the Data Quality panel on
    ControlChartsView.

    One aggregate query; window functions are used for outlier detection
    (gate based on mean/stddev over the same filtered population) and
    time-gap percentiles. No per-row fetch.
    """
    params = [
        sql_param("material_id", material_id),
        sql_param("mic_id", mic_id),
    ]
    conditions = [
        "r.MATERIAL_ID = :material_id",
        "r.MIC_ID = :mic_id",
    ]
    if operation_id:
        conditions.append("r.OPERATION_ID = :operation_id")
        params.append(sql_param("operation_id", operation_id))
    if date_from:
        conditions.append("mb.POSTING_DATE >= :date_from")
        params.append(sql_param("date_from", date_from))
    if date_to:
        conditions.append("mb.POSTING_DATE <= :date_to")
        params.append(sql_param("date_to", date_to))
    if plant_id:
        conditions.append("mb.PLANT_ID = :plant_id")
        params.append(sql_param("plant_id", plant_id))

    where_clause = " AND ".join(conditions)

    query = f"""
        WITH filtered AS (
            SELECT
                r.BATCH_ID                                     AS batch_id,
                r.QUANTITATIVE_RESULT                          AS raw_value,
                TRY_CAST(r.QUANTITATIVE_RESULT AS DOUBLE)      AS value,
                mb.POSTING_DATE                                AS posting_date
            FROM {tbl('gold_batch_quality_result_v')} r
            JOIN (
                SELECT BATCH_ID, MATERIAL_ID, MIN(POSTING_DATE) AS POSTING_DATE, MAX(PLANT_ID) AS PLANT_ID
                FROM {tbl('gold_batch_mass_balance_mat')}
                WHERE MOVEMENT_CATEGORY = 'Production'
                GROUP BY BATCH_ID, MATERIAL_ID
            ) mb ON mb.BATCH_ID = r.BATCH_ID AND mb.MATERIAL_ID = r.MATERIAL_ID
            WHERE {where_clause}
        ),
        sample_stats AS (
            SELECT
                COUNT(*)                                                                               AS n_samples,
                COUNT(DISTINCT batch_id)                                                               AS n_batches,
                COUNT(CASE WHEN raw_value IS NULL OR raw_value = '' THEN 1 END)                        AS n_missing_values,
                COUNT(CASE WHEN value IS NULL AND raw_value IS NOT NULL AND raw_value != '' THEN 1 END) AS n_unparseable_values,
                AVG(value)                                                                             AS mean_value,
                STDDEV_SAMP(value)                                                                     AS stddev_value
            FROM filtered
        ),
        outlier_stats AS (
            SELECT COUNT(*) AS n_outliers_3sigma
            FROM filtered f
            CROSS JOIN sample_stats s
            WHERE f.value IS NOT NULL
              AND s.stddev_value IS NOT NULL
              AND s.stddev_value > 0
              AND ABS(f.value - s.mean_value) > 3 * s.stddev_value
        ),
        per_batch AS (
            SELECT batch_id, MIN(posting_date) AS batch_date
            FROM filtered
            GROUP BY batch_id
        ),
        batch_stats AS (
            SELECT MIN(batch_date) AS first_batch_date, MAX(batch_date) AS last_batch_date
            FROM per_batch
        ),
        gap_stats AS (
            SELECT
                PERCENTILE(gap_days, 0.5)  AS median_gap_days,
                PERCENTILE(gap_days, 0.95) AS p95_gap_days,
                MAX(gap_days)              AS max_gap_days
            FROM (
                SELECT DATEDIFF(
                    batch_date,
                    LAG(batch_date) OVER (ORDER BY batch_date)
                ) AS gap_days
                FROM per_batch
            )
            WHERE gap_days IS NOT NULL
        )
        SELECT
            s.n_samples,
            s.n_batches,
            s.n_missing_values,
            s.n_unparseable_values,
            s.mean_value,
            s.stddev_value,
            o.n_outliers_3sigma,
            bs.first_batch_date,
            bs.last_batch_date,
            gs.median_gap_days,
            gs.p95_gap_days,
            gs.max_gap_days
        FROM sample_stats s
        CROSS JOIN outlier_stats o
        CROSS JOIN batch_stats bs
        CROSS JOIN gap_stats gs
    """
    rows = await run_sql_async(token, query, params, endpoint_hint="spc.charts.data-quality")
    row = rows[0] if rows else {}

    # Phase 2.2: opportunistically probe for the optional USAGE_DECISION_CODE
    # column. If present upstream, run a second aggregate to return a
    # disposition breakdown; otherwise return None so the frontend knows the
    # feature is dormant. No failure if the probe or breakdown query errors.
    disposition_breakdown: Optional[dict] = None
    try:
        optional_cols = await detect_optional_columns(
            token, TRACE_CATALOG, TRACE_SCHEMA, "gold_batch_quality_result_v"
        )
    except Exception:
        optional_cols = set()
    if "USAGE_DECISION_CODE" in optional_cols:
        try:
            disp_query = f"""
                SELECT
                    COALESCE(r.USAGE_DECISION_CODE, '__UNSET__') AS code,
                    COUNT(*)                                     AS n
                FROM {tbl('gold_batch_quality_result_v')} r
                JOIN (
                    SELECT BATCH_ID, MATERIAL_ID, MIN(POSTING_DATE) AS POSTING_DATE, MAX(PLANT_ID) AS PLANT_ID
                    FROM {tbl('gold_batch_mass_balance_mat')}
                    WHERE MOVEMENT_CATEGORY = 'Production'
                    GROUP BY BATCH_ID, MATERIAL_ID
                ) mb ON mb.BATCH_ID = r.BATCH_ID AND mb.MATERIAL_ID = r.MATERIAL_ID
                WHERE {where_clause}
                GROUP BY COALESCE(r.USAGE_DECISION_CODE, '__UNSET__')
            """
            disp_rows = await run_sql_async(
                token, disp_query, params, endpoint_hint="spc.charts.data-quality"
            )
            disposition_breakdown = {
                str(drow.get("code") or "__UNSET__"): int(float(drow.get("n") or 0))
                for drow in disp_rows
            }
        except Exception:
            disposition_breakdown = None

    def _num(val, default=0):
        if val is None:
            return default
        try:
            return float(val)
        except (TypeError, ValueError):
            return default

    def _int(val, default=0):
        try:
            return int(_num(val, default))
        except (TypeError, ValueError):
            return default

    n_samples = _int(row.get("n_samples"))
    n_missing = _int(row.get("n_missing_values"))
    denom = max(n_samples, 1)
    return {
        "n_samples": n_samples,
        "n_batches": _int(row.get("n_batches")),
        "n_missing_values": n_missing,
        "n_unparseable_values": _int(row.get("n_unparseable_values")),
        "pct_missing": round(n_missing / denom, 4),
        "n_outliers_3sigma": _int(row.get("n_outliers_3sigma")),
        "mean_value": None if row.get("mean_value") is None else round(_num(row.get("mean_value")), 6),
        "stddev_value": None if row.get("stddev_value") is None else round(_num(row.get("stddev_value")), 6),
        "first_batch_date": row.get("first_batch_date"),
        "last_batch_date": row.get("last_batch_date"),
        "median_gap_days": None if row.get("median_gap_days") is None else round(_num(row.get("median_gap_days")), 2),
        "p95_gap_days": None if row.get("p95_gap_days") is None else round(_num(row.get("p95_gap_days")), 2),
        "max_gap_days": None if row.get("max_gap_days") is None else round(_num(row.get("max_gap_days")), 2),
        # Phase 2.2: null when upstream gold view has no USAGE_DECISION_CODE
        # column; otherwise a {code: count} map. UI renders a chip row when
        # non-null, and the rework-filter affordance on SPCFilterBar becomes
        # available.
        "disposition_breakdown": disposition_breakdown,
    }
