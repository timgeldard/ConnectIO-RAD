"""Filter specification and CTE/SQL builders for SPC chart queries.

Encapsulates the WHERE-condition and parameter assembly for chart endpoints so
that the public ``fetch_*`` functions in ``charts.py`` stay focused on
orchestration rather than SQL fragment composition.

Extracted from ``charts.py`` (review item M-5).  ``charts.py`` re-exports
``ChartFilterSpec``, ``_build_chart_filters``, ``_build_chart_page_query``,
``_build_chart_values_query``, and ``_where_clause`` for backward compatibility
with callers and tests.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from shared_trace import schema

from spc_backend.process_control.dal._chart_cursor import decode_chart_cursor
from spc_backend.utils.db import sql_param, tbl


# Whitelist of columns that may be selected as the stratify dimension.
# Bound to fully-qualified SQL expressions to prevent injection via user input.
_ALLOWED_STRATIFY_COLUMNS = {
    "plant_id": "bd.plant_id",
    "inspection_lot_id": "CAST(r.INSPECTION_LOT_ID AS STRING)",
    "operation_id": "CAST(r.OPERATION_ID AS STRING)",
    "phase_name": "p.PHASE_NAME",
}


@dataclass
class ChartFilterSpec:
    """Parameter-and-WHERE-condition bundle used by chart query builders.

    Three condition lists are kept separate so each CTE only applies the
    predicates relevant to its scan:
    - ``batch_date_conditions``: applied inside ``batch_dates`` CTE
    - ``quality_conditions``: applied inside ``quality_data`` CTE
    - ``final_where_conditions``: applied to the outer SELECT (e.g. cursor predicates)
    """

    params: list[dict]
    batch_date_conditions: list[str] = field(default_factory=list)
    quality_conditions: list[str] = field(default_factory=list)
    final_where_conditions: list[str] = field(default_factory=list)
    stratify_by: Optional[str] = None
    stratify_select_sql: Optional[str] = None


def _where_clause(conditions: list[str]) -> str:
    """Join non-empty conditions into a ``WHERE a AND b ...`` clause, or return ''."""
    if not conditions:
        return ""
    return "WHERE " + " AND ".join(conditions)


def _build_chart_filters(
    material_id: str,
    mic_id: str,
    mic_name: Optional[str],
    plant_id: Optional[str],
    date_from: Optional[str],
    date_to: Optional[str],
    stratify_by: Optional[str] = None,
    operation_id: Optional[str] = None,
) -> ChartFilterSpec:
    """Assemble a ``ChartFilterSpec`` from user-supplied chart parameters.

    Raises ``ValueError`` when ``stratify_by`` is not one of the allowed columns;
    other parameters are bound via ``:placeholders`` and validated by the SQL
    type system at execution time.
    """
    params = [
        sql_param("material_id", material_id),
        sql_param("mic_id", mic_id),
    ]
    batch_date_conditions = [
        "MATERIAL_ID = :material_id",
    ]
    quality_conditions = [
        "r.MATERIAL_ID = :material_id",
        "r.MIC_ID = :mic_id",
        "r.QUANTITATIVE_RESULT IS NOT NULL",
        "(r.QUALITATIVE_RESULT IS NULL OR r.QUALITATIVE_RESULT = '')",
    ]
    final_where_conditions: list[str] = []

    if operation_id:
        params.append(sql_param("operation_id", operation_id))
        quality_conditions.append("r.OPERATION_ID = :operation_id")
    if date_from:
        batch_date_conditions.append("batch_date >= :date_from")
        params.append(sql_param("date_from", date_from))
    if date_to:
        batch_date_conditions.append("batch_date <= :date_to")
        params.append(sql_param("date_to", date_to))
    if plant_id:
        params.append(sql_param("plant_id", plant_id))
        quality_conditions.append("(bd.plant_id = :plant_id OR bd.plant_id IS NULL)")
    stratify_select_sql = None
    if stratify_by:
        stratify_select_sql = _ALLOWED_STRATIFY_COLUMNS.get(stratify_by)
        if stratify_select_sql is None:
            raise ValueError(
                f"stratify_by must be one of {sorted(_ALLOWED_STRATIFY_COLUMNS)}"
            )
    return ChartFilterSpec(
        params=params,
        batch_date_conditions=batch_date_conditions,
        quality_conditions=quality_conditions,
        final_where_conditions=final_where_conditions,
        stratify_by=stratify_by,
        stratify_select_sql=stratify_select_sql,
    )


def _build_batch_dates_cte_sql(filters: ChartFilterSpec) -> str:
    """Build the ``batch_dates`` CTE that maps each (material, batch) to its date and plant."""
    return f"""
        batch_dates AS (
            SELECT
                MATERIAL_ID,
                BATCH_ID,
                batch_date,
                plant_id
            FROM {tbl('spc_batch_dim_mv')}
            {_where_clause(filters.batch_date_conditions)}
        )
    """


def _build_quality_data_cte_sql(filters: ChartFilterSpec) -> str:
    """Build the ``quality_data`` CTE that joins quality results to batch dates and phases."""
    stratify_select = ""
    if filters.stratify_select_sql:
        stratify_select = f",\n                {filters.stratify_select_sql} AS stratify_value"
    return f"""
        quality_data AS (
            SELECT
                r.BATCH_ID AS batch_id,
                r.INSPECTION_LOT_ID,
                r.OPERATION_ID,
                p.PHASE_NAME AS phase_name,
                p.PHASE_NUMBER AS phase_number,
                r.SAMPLE_ID,
                r.attribute AS attribut,
                TRY_CAST(r.QUANTITATIVE_RESULT AS DOUBLE) AS value,
                TRY_CAST(r.TARGET_VALUE AS DOUBLE) AS nominal,
                TRY_CAST(
                    CASE
                        WHEN LOCATE('...', r.TOLERANCE) > 0
                        THEN SUBSTRING(r.TOLERANCE, 1, LOCATE('...', r.TOLERANCE) - 1)
                    END AS DOUBLE
                ) AS lsl,
                TRY_CAST(
                    CASE
                        WHEN LOCATE('...', r.TOLERANCE) > 0
                        THEN SUBSTRING(r.TOLERANCE, LOCATE('...', r.TOLERANCE) + 3)
                    END AS DOUBLE
                ) AS usl,
                CASE
                    WHEN LOCATE('...', r.TOLERANCE) = 0 THEN TRY_CAST(r.TOLERANCE AS DOUBLE)
                END AS tolerance,
                r.INSPECTION_RESULT_VALUATION AS valuation,
                bd.batch_date,
                bd.plant_id,
                COALESCE(UNIX_TIMESTAMP(CAST(bd.batch_date AS TIMESTAMP)), 253402214400) AS cursor_batch_date_epoch,
                COALESCE(CAST(r.SAMPLE_ID AS STRING), '') AS cursor_sample_id,
                COALESCE(CAST(r.INSPECTION_LOT_ID AS STRING), '') AS cursor_inspection_lot_id,
                COALESCE(CAST(r.OPERATION_ID AS STRING), '') AS cursor_operation_id,
                ROW_NUMBER() OVER (
                    PARTITION BY r.BATCH_ID
                    ORDER BY COALESCE(CAST(r.SAMPLE_ID AS STRING), ''), r.INSPECTION_LOT_ID, r.OPERATION_ID
                ) AS sample_seq
                {stratify_select}
            FROM {tbl('gold_batch_quality_result_v')} r
            INNER JOIN batch_dates bd
                ON bd.MATERIAL_ID = r.MATERIAL_ID
               AND bd.BATCH_ID = r.BATCH_ID
            LEFT JOIN {tbl(schema.GOLD_INSPECTION_LOT)} l
                ON l.INSPECTION_LOT_ID = r.INSPECTION_LOT_ID
            LEFT JOIN {tbl(schema.GOLD_PROCESS_PHASE)} p
                ON p.ORDER_ID = l.PROCESS_ORDER_ID
               AND p.PHASE_ID = l.PHASE_ID
            {_where_clause(filters.quality_conditions)}
        )
    """


def _build_chart_page_query(
    filters: ChartFilterSpec, cursor: Optional[str], limit: int
) -> tuple[str, list[dict]]:
    """Assemble the keyset-paginated chart-page SQL plus its bound parameters.

    When a cursor is supplied, decodes it and adds a 5-tuple comparison predicate
    to ``filters.final_where_conditions`` so the next page resumes immediately
    after the cursor row.  Returns ``LIMIT limit + 1`` so the application layer
    can detect ``has_more`` without an additional COUNT query.
    """
    params = list(filters.params)
    if cursor:
        (
            cursor_batch_date_epoch,
            cursor_batch_id,
            cursor_sample_id,
            cursor_inspection_lot_id,
            cursor_operation_id,
        ) = decode_chart_cursor(cursor)
        params.extend(
            [
                sql_param("cursor_batch_date_epoch", cursor_batch_date_epoch),
                sql_param("cursor_batch_id", cursor_batch_id),
                sql_param("cursor_sample_id", cursor_sample_id),
                sql_param("cursor_inspection_lot_id", cursor_inspection_lot_id),
                sql_param("cursor_operation_id", cursor_operation_id),
            ]
        )
        filters.final_where_conditions.extend(
            [
                "("
                "cursor_batch_date_epoch > :cursor_batch_date_epoch "
                "OR (cursor_batch_date_epoch = :cursor_batch_date_epoch AND batch_id > :cursor_batch_id) "
                "OR (cursor_batch_date_epoch = :cursor_batch_date_epoch AND batch_id = :cursor_batch_id "
                "AND cursor_sample_id > :cursor_sample_id) "
                "OR (cursor_batch_date_epoch = :cursor_batch_date_epoch AND batch_id = :cursor_batch_id "
                "AND cursor_sample_id = :cursor_sample_id "
                "AND cursor_inspection_lot_id > :cursor_inspection_lot_id) "
                "OR (cursor_batch_date_epoch = :cursor_batch_date_epoch AND batch_id = :cursor_batch_id "
                "AND cursor_sample_id = :cursor_sample_id "
                "AND cursor_inspection_lot_id = :cursor_inspection_lot_id "
                "AND cursor_operation_id > :cursor_operation_id)"
                ")"
            ]
        )
    stratify_select = ""
    if filters.stratify_select_sql:
        stratify_select = ",\n            stratify_value"

    # CRITICAL: ORDER BY must use the same columns as the cursor WHERE clause,
    # otherwise keyset pagination silently skips rows at page boundaries when
    # raw INSPECTION_LOT_ID / OPERATION_ID (BIGINT) sort order differs from the
    # string-casted cursor columns. Manifests as missing X-bar / Range points
    # in the X-R chart (each paginated gap drops samples from a subgroup).
    final_query = f"""
        WITH
        {_build_batch_dates_cte_sql(filters)},
        {_build_quality_data_cte_sql(filters)}
        SELECT
            batch_id,
            CAST(batch_date AS STRING) AS batch_date,
            sample_seq,
            attribut,
            value,
            nominal,
            tolerance,
            lsl,
            usl,
            valuation,
            plant_id,
            cursor_batch_date_epoch,
            cursor_sample_id,
            cursor_inspection_lot_id,
            cursor_operation_id
            {stratify_select}
        FROM quality_data
        {_where_clause(filters.final_where_conditions)}
        ORDER BY
            cursor_batch_date_epoch,
            batch_id,
            cursor_sample_id,
            cursor_inspection_lot_id,
            cursor_operation_id
        LIMIT {limit + 1}
    """
    return final_query, params


def _build_chart_values_query(
    filters: ChartFilterSpec, max_points: int
) -> tuple[str, list[dict]]:
    """Assemble the SQL used to fetch raw quantitative values for normality / capability.

    Returns only the ``value`` column; sample/lot identifiers are not needed
    downstream and dropping them lets the warehouse skip the wider scan.
    """
    final_query = f"""
        WITH
        {_build_batch_dates_cte_sql(filters)}
        SELECT
            CAST(r.QUANTITATIVE_RESULT AS DOUBLE) AS value
        FROM {tbl('gold_batch_quality_result_v')} r
        INNER JOIN batch_dates bd
            ON bd.MATERIAL_ID = r.MATERIAL_ID
           AND bd.BATCH_ID = r.BATCH_ID
        {_where_clause(filters.quality_conditions)}
        ORDER BY
            bd.batch_date,
            r.BATCH_ID,
            r.SAMPLE_ID,
            r.INSPECTION_LOT_ID
        LIMIT {max_points}
    """
    return final_query, list(filters.params)
