"""DAL for the process order detail view.

Runs 8 Databricks queries in parallel (asyncio.gather) to fetch all data
needed for the OrderDetail page:
  1. header       — order header, material, batch dates, supplier batch
  2. phases       — process phases with timing aggregated from confirmations
  3. movements    — ADP goods movements (261 issues + 101 receipts)
  4. comments     — operator notes / log entries
  5. downtime     — downtime and issue records
  6. equipment    — equipment status change history
  7. inspections  — inspection characteristic results with specifications
  8. usage_decision — QM usage decision (first lot only)

``materials`` (BOM component summary) and ``movement_summary`` are derived
from the movements list in Python, keeping the query count at 8.
"""
import asyncio
from typing import Optional

from backend.db import ORDER_STATUS_EXPR, run_sql_async, sql_param, tbl
from backend.order_execution.domain.movements import (
    MovementQuantity,
    derive_materials,
    movement_summary,
)


# ---------------------------------------------------------------------------
# Individual query coroutines
# ---------------------------------------------------------------------------

async def _q_header(token: str, order_id: str) -> list[dict]:
    """Order header joined to material, process-order material, and batch master."""
    query = f"""
        SELECT
            po.PROCESS_ORDER_ID                                              AS process_order_id,
            po.INSPECTION_LOT_ID                                             AS inspection_lot_id,
            po.MATERIAL_ID                                                   AS material_id,
            po.PLANT_ID                                                      AS plant_id,
            po.STATUS                                                        AS raw_status,
            {ORDER_STATUS_EXPR}                                              AS status,
            COALESCE(m.MATERIAL_NAME, po.MATERIAL_DESCRIPTION)               AS material_name,
            m.MATERIAL_CATEGORY                                              AS material_category,
            pom.BATCH_ID                                                     AS batch_id,
            CAST(UNIX_TIMESTAMP(pom.DATE_OF_MANUFACTURING) * 1000 AS BIGINT) AS manufacture_date_ms,
            CAST(UNIX_TIMESTAMP(pom.EXPIRY_DATE) * 1000 AS BIGINT)          AS expiry_date_ms,
            bm.SUPPLIER_BATCH_ID                                             AS supplier_batch_id
        FROM {tbl('vw_gold_process_order')} po
        LEFT JOIN {tbl('vw_gold_material')} m
            ON m.MATERIAL_ID = po.MATERIAL_ID
           AND m.LANGUAGE_ID = 'E'
        LEFT JOIN {tbl('vw_gold_process_order_material')} pom
            ON pom.PROCESS_ORDER_ID = po.PROCESS_ORDER_ID
           AND pom.MATERIAL_ID = po.MATERIAL_ID
        LEFT JOIN {tbl('vw_gold_batch_material')} bm
            ON bm.BATCH_ID = pom.BATCH_ID
           AND bm.MATERIAL_ID = po.MATERIAL_ID
        WHERE po.PROCESS_ORDER_ID = :order_id
        LIMIT 1
    """
    return await run_sql_async(
        token, query, [sql_param("order_id", order_id)],
        endpoint_hint="poh.detail.header",
    )


async def _q_phases(token: str, order_id: str) -> list[dict]:
    """Process phases with timing aggregated from confirmation records."""
    query = f"""
        WITH conf AS (
            SELECT
                PHASE_ID,
                COALESCE(SUM(SET_UP_DURATION_S), 0)   AS setup_s,
                COALESCE(SUM(MACHINE_DURATION_S), 0)  AS mach_s,
                COALESCE(SUM(CLEANING_DURATION_S), 0) AS clean_s
            FROM {tbl('vw_gold_confirmation')}
            WHERE PROCESS_ORDER_ID = :order_id
            GROUP BY PHASE_ID
        )
        SELECT
            p.PHASE_ID                  AS phase_id,
            p.PHASE_DESCRIPTION         AS phase_description,
            p.PHASE_TEXT                AS phase_text,
            p.OPERATION_QUANTITY        AS operation_quantity,
            p.OPERATION_QUANTITY_UOM    AS operation_quantity_uom,
            p.START_USER                AS start_user,
            p.END_USER                  AS end_user,
            COALESCE(c.setup_s, 0)      AS setup_s,
            COALESCE(c.mach_s,  0)      AS mach_s,
            COALESCE(c.clean_s, 0)      AS clean_s
        FROM {tbl('vw_gold_process_order_phase')} p
        LEFT JOIN conf c ON c.PHASE_ID = p.PHASE_ID
        WHERE p.PROCESS_ORDER_ID = :order_id
        ORDER BY p.SORT_NUMBER
    """
    return await run_sql_async(
        token, query, [sql_param("order_id", order_id)],
        endpoint_hint="poh.detail.phases",
    )


async def _q_movements(token: str, order_id: str) -> list[dict]:
    """ADP goods movements joined to material master for human-readable names.

    USER is a SQL reserved word — must be backtick-quoted.
    """
    query = f"""
        SELECT
            adp.MATERIAL_ID                                                      AS material_id,
            COALESCE(m.MATERIAL_NAME, adp.MATERIAL_ID)                           AS material_name,
            adp.BATCH_ID                                                         AS batch_id,
            adp.MOVEMENT_TYPE                                                    AS movement_type,
            adp.QUANTITY                                                         AS quantity,
            adp.UOM                                                              AS uom,
            adp.STORAGE_ID                                                       AS storage_id,
            adp.`USER`                                                           AS user_name,
            CAST(UNIX_TIMESTAMP(adp.DATE_TIME_OF_ENTRY) * 1000 AS BIGINT)        AS date_time_of_entry
        FROM {tbl('vw_gold_adp_movement')} adp
        LEFT JOIN {tbl('vw_gold_material')} m
            ON m.MATERIAL_ID = adp.MATERIAL_ID
           AND m.LANGUAGE_ID = 'E'
        WHERE adp.PROCESS_ORDER_ID = :order_id
        ORDER BY adp.DATE_TIME_OF_ENTRY
    """
    return await run_sql_async(
        token, query, [sql_param("order_id", order_id)],
        endpoint_hint="poh.detail.movements",
    )


async def _q_comments(token: str, order_id: str) -> list[dict]:
    """Operator notes and log entries."""
    query = f"""
        SELECT
            CAST(UNIX_TIMESTAMP(CREATED) * 1000 AS BIGINT) AS created_ms,
            SENDER                                          AS sender,
            NOTES                                           AS notes,
            PHASE_ID                                        AS phase_id
        FROM {tbl('vw_gold_logs_notes_and_comments')}
        WHERE PROCESS_ORDER_ID = :order_id
        ORDER BY CREATED
    """
    return await run_sql_async(
        token, query, [sql_param("order_id", order_id)],
        endpoint_hint="poh.detail.comments",
    )


async def _q_downtime(token: str, order_id: str) -> list[dict]:
    """Downtime and issue records."""
    query = f"""
        SELECT
            CAST(UNIX_TIMESTAMP(START_TIME) * 1000 AS BIGINT) AS start_time_ms,
            DURATION                                            AS duration_s,
            REASON_CODE                                         AS reason_code,
            SUB_REASON_CODE                                     AS sub_reason_code,
            ISSUE_TYPE                                          AS issue_type,
            ISSUE_TITLE                                         AS issue_title,
            OPERATORS_COMMENTS                                  AS operators_comments
        FROM {tbl('vw_gold_downtime_and_issues')}
        WHERE PROCESS_ORDER_ID = :order_id
        ORDER BY START_TIME
    """
    return await run_sql_async(
        token, query, [sql_param("order_id", order_id)],
        endpoint_hint="poh.detail.downtime",
    )


async def _q_equipment(token: str, order_id: str) -> list[dict]:
    """Equipment status change records."""
    query = f"""
        SELECT
            EQUIPMENT_TYPE                                     AS equipment_type,
            INSTRUMENT_ID                                      AS instrument_id,
            STATUS_FROM                                        AS status_from,
            STATUS_TO                                          AS status_to,
            CAST(UNIX_TIMESTAMP(CHANGE_AT) * 1000 AS BIGINT)  AS change_at_ms
        FROM {tbl('vw_gold_equipment_history')}
        WHERE PROCESS_ORDER_ID = :order_id
        ORDER BY CHANGE_AT
    """
    return await run_sql_async(
        token, query, [sql_param("order_id", order_id)],
        endpoint_hint="poh.detail.equipment",
    )


async def _q_inspections(token: str, order_id: str) -> list[dict]:
    """Inspection characteristic results with specification metadata.

    INSPECTION_RESULT_VALUATION real values are undocumented; treat any value
    starting with 'A' as accepted, anything else as rejected.
    """
    query = f"""
        SELECT
            ir.INSPECTION_CHARACTERISTIC_ID                                AS characteristic_id,
            COALESCE(spec.MIC_NAME, ir.INSPECTION_CHARACTERISTIC_ID)       AS characteristic_description,
            ir.SAMPLE_ID                                                   AS sample_id,
            spec.TOLERANCE                                                 AS specification,
            ir.QUANTITATIVE_RESULT                                         AS quantitative_result,
            ir.QUALITATIVE_RESULT                                          AS qualitative_result,
            spec.UNIT_OF_MEASURE                                           AS uom,
            CASE WHEN ir.INSPECTION_RESULT_VALUATION LIKE 'A%' THEN 'A'
                 ELSE 'R'
            END                                                            AS judgement
        FROM {tbl('vw_gold_inspection_result')} ir
        LEFT JOIN {tbl('vw_gold_inspection_specification')} spec
            ON spec.INSPECTION_CHARACTERISTIC_ID = ir.INSPECTION_CHARACTERISTIC_ID
           AND spec.INSPECTION_OPERATION_ID = ir.INSPECTION_OPERATION_ID
        WHERE ir.PROCESS_ORDER_ID = :order_id
        ORDER BY ir.INSPECTION_CHARACTERISTIC_ID, ir.SAMPLE_ID
    """
    return await run_sql_async(
        token, query, [sql_param("order_id", order_id)],
        endpoint_hint="poh.detail.inspections",
    )


async def _q_usage_decision(token: str, order_id: str) -> list[dict]:
    """QM usage decision for the first inspection lot linked to this order."""
    query = f"""
        SELECT
            ud.USAGE_DECISION_CODE                                               AS usage_decision_code,
            ud.VALUATION_CODE                                                    AS valuation_code,
            ud.QUALITY_SCORE                                                     AS quality_score,
            ud.USAGE_DECISION_CREATED_BY                                         AS created_by,
            CAST(UNIX_TIMESTAMP(ud.USAGE_DECISION_CREATED_DATE) * 1000 AS BIGINT) AS created_date_ms
        FROM {tbl('vw_gold_inspection_lot')} il
        JOIN {tbl('vw_gold_inspection_usage_decision')} ud
            ON ud.INSPECTION_LOT_ID = il.INSPECTION_LOT_ID
        WHERE il.PROCESS_ORDER_ID = :order_id
        LIMIT 1
    """
    return await run_sql_async(
        token, query, [sql_param("order_id", order_id)],
        endpoint_hint="poh.detail.usage_decision",
    )


# ---------------------------------------------------------------------------
# Coerce helpers — convert Databricks string-serialised values to Python types
# ---------------------------------------------------------------------------

def _coerce_header(row: dict) -> dict:
    for key in ("manufacture_date_ms", "expiry_date_ms"):
        v = row.get(key)
        row[key] = int(v) if v is not None else None
    return row


def _coerce_phase(row: dict) -> dict:
    for key in ("setup_s", "mach_s", "clean_s"):
        v = row.get(key)
        row[key] = float(v) if v is not None else 0.0
    v = row.get("operation_quantity")
    row["operation_quantity"] = float(v) if v is not None else 0.0
    return row


def _coerce_movement(row: dict) -> dict:
    v = row.get("quantity")
    row["quantity"] = float(v) if v is not None else 0.0
    v = row.get("date_time_of_entry")
    row["date_time_of_entry"] = int(v) if v is not None else None
    return row


def _coerce_comment(row: dict) -> dict:
    v = row.get("created_ms")
    row["created_ms"] = int(v) if v is not None else None
    return row


def _coerce_downtime(row: dict) -> dict:
    v = row.get("start_time_ms")
    row["start_time_ms"] = int(v) if v is not None else None
    v = row.get("duration_s")
    row["duration_s"] = float(v) if v is not None else 0.0
    return row


def _coerce_equipment(row: dict) -> dict:
    v = row.get("change_at_ms")
    row["change_at_ms"] = int(v) if v is not None else None
    return row


def _coerce_inspection(row: dict) -> dict:
    v = row.get("quantitative_result")
    row["quantitative_result"] = float(v) if v is not None else None
    return row


def _coerce_usage_decision(row: dict) -> dict:
    v = row.get("created_date_ms")
    row["created_date_ms"] = int(v) if v is not None else None
    v = row.get("quality_score")
    row["quality_score"] = float(v) if v is not None else None
    return row


# ---------------------------------------------------------------------------
# Derived aggregations (computed from movements, no extra queries)
# ---------------------------------------------------------------------------

def _derive_materials(movements: list[dict]) -> list[dict]:
    """Aggregate 261/262 movements into a net BOM-style component list.

    MT-262 (return from production order) is subtracted from MT-261 (goods issue)
    to compute the net issued quantity per material.  EA (each/packaging) materials
    are excluded.  G quantities are normalised to KG.  Totals are rounded to 6dp.
    Materials with a net total of zero or less (fully reversed) are omitted.
    Takes the first batch_id seen from a MT-261 movement as the representative batch.
    """
    return derive_materials(movements)


def _to_kg(qty: float, uom: str | None) -> float:
    """Normalise a quantity to KG. EA (each) returns 0; G (gram) is divided by 1000."""
    return MovementQuantity(qty, uom).to_kg()


def _movement_summary(movements: list[dict]) -> dict:
    """Net kg issued (261 minus 262) and received (101 minus 102) for the summary strip.

    MT-262 (return from production order) is subtracted from MT-261 issues to
    compute the net issued quantity.  Similarly, MT-102 (production reversal)
    is subtracted from MT-101 receipts.  EA movements are excluded; G quantities
    are converted to KG before summing.  Totals are rounded to 6 decimal places.
    """
    return movement_summary(movements).to_dict()


def _time_summary(phases: list[dict]) -> dict:
    """Sum setup/machine/cleaning seconds across all phases."""
    return {
        "setup_s": sum(p.get("setup_s") or 0 for p in phases),
        "mach_s": sum(p.get("mach_s") or 0 for p in phases),
        "clean_s": sum(p.get("clean_s") or 0 for p in phases),
    }


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def fetch_order_detail(token: str, *, order_id: str) -> Optional[dict]:
    """Fetch full order detail via 8 parallel Databricks queries.

    Returns ``None`` if no order with ``order_id`` exists.
    """
    (
        header_rows,
        phases_rows,
        movements_rows,
        comments_rows,
        downtime_rows,
        equipment_rows,
        inspections_rows,
        ud_rows,
    ) = await asyncio.gather(
        _q_header(token, order_id),
        _q_phases(token, order_id),
        _q_movements(token, order_id),
        _q_comments(token, order_id),
        _q_downtime(token, order_id),
        _q_equipment(token, order_id),
        _q_inspections(token, order_id),
        _q_usage_decision(token, order_id),
    )

    if not header_rows:
        return None

    header = _coerce_header(header_rows[0])
    phases = [_coerce_phase(r) for r in phases_rows]
    movements = [_coerce_movement(r) for r in movements_rows]
    comments = [_coerce_comment(r) for r in comments_rows]
    downtime = [_coerce_downtime(r) for r in downtime_rows]
    equipment = [_coerce_equipment(r) for r in equipment_rows]
    inspections = [_coerce_inspection(r) for r in inspections_rows]
    usage_decision = _coerce_usage_decision(ud_rows[0]) if ud_rows else None

    return {
        "order": header,
        "time_summary": _time_summary(phases),
        "movement_summary": _movement_summary(movements),
        "phases": phases,
        "materials": _derive_materials(movements),
        "movements": movements,
        "comments": comments,
        "downtime": downtime,
        "equipment": equipment,
        "inspections": inspections,
        "usage_decision": usage_decision,
    }
