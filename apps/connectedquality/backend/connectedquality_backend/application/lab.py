"""Lab Board application service backed by inspection-result gold views."""
from typing import Optional

from connectedquality_backend.db import CQ_CATALOG, run_sql_async, sql_param


def _tbl(name: str) -> str:
    return f"`{CQ_CATALOG}`.`csm_process_order_history`.`{name}`"


def _coerce_fail(row: dict) -> dict:
    result = row.get("quantitative_result")
    lo = row.get("lower_limit")
    hi = row.get("upper_limit")
    valuation = str(row.get("judgement") or "R")
    return {
        "mat": str(row.get("material_name") or row.get("material_id") or "—"),
        "matNo": str(row.get("material_id") or "—"),
        "lot": str(row.get("inspection_lot_id") or "—"),
        "batch": str(row.get("batch_id") or row.get("process_order") or "—"),
        "line": str(row.get("process_line") or "—"),
        "char": str(row.get("characteristic_id") or "—"),
        "text": str(row.get("characteristic_description") or row.get("characteristic_id") or "—"),
        "res": float(result) if result is not None else 0.0,
        "lo": float(lo) if lo is not None else 0.0,
        "hi": float(hi) if hi is not None else 0.0,
        "units": str(row.get("uom") or ""),
        "sev": "warn" if valuation == "W" else "fail",
    }


async def fetch_lab_failures(token: str, *, plant_id: str, lot_type: Optional[str] = None) -> dict:
    params = [sql_param("plant_id", plant_id)]

    query = f"""
        SELECT
            ir.PROCESS_ORDER_ID                                      AS process_order,
            po.INSPECTION_LOT_ID                                     AS inspection_lot_id,
            pom.BATCH_ID                                             AS batch_id,
            po.MATERIAL_ID                                           AS material_id,
            COALESCE(mat.MATERIAL_NAME, po.MATERIAL_DESCRIPTION, po.MATERIAL_ID) AS material_name,
            COALESCE(plan.PROCESS_LINE, 'UNKNOWN')                   AS process_line,
            ir.INSPECTION_CHARACTERISTIC_ID                          AS characteristic_id,
            COALESCE(spec.MIC_NAME, ir.INSPECTION_CHARACTERISTIC_ID)  AS characteristic_description,
            ir.QUANTITATIVE_RESULT                                   AS quantitative_result,
            NULL                                                     AS lower_limit,
            NULL                                                     AS upper_limit,
            spec.UNIT_OF_MEASURE                                     AS uom,
            CASE
                WHEN ir.INSPECTION_RESULT_VALUATION LIKE 'A%' THEN 'A'
                WHEN ir.INSPECTION_RESULT_VALUATION LIKE 'W%' THEN 'W'
                ELSE 'R'
            END                                                      AS judgement,
            ud.USAGE_DECISION_CREATED_DATE                           AS result_ts
        FROM {_tbl('vw_gold_inspection_result')} ir
        JOIN {_tbl('vw_gold_process_order')} po
          ON po.PROCESS_ORDER_ID = ir.PROCESS_ORDER_ID
        LEFT JOIN {_tbl('vw_gold_process_order_plan')} plan
          ON plan.PROCESS_ORDER_ID = po.PROCESS_ORDER_ID
        LEFT JOIN {_tbl('vw_gold_process_order_material')} pom
          ON pom.PROCESS_ORDER_ID = po.PROCESS_ORDER_ID
         AND pom.MATERIAL_ID = po.MATERIAL_ID
        LEFT JOIN {_tbl('vw_gold_inspection_usage_decision')} ud
          ON ud.INSPECTION_LOT_ID = po.INSPECTION_LOT_ID
        LEFT JOIN {_tbl('vw_gold_inspection_specification')} spec
          ON spec.INSPECTION_CHARACTERISTIC_ID = ir.INSPECTION_CHARACTERISTIC_ID
         AND spec.INSPECTION_OPERATION_ID = ir.INSPECTION_OPERATION_ID
        LEFT JOIN {_tbl('vw_gold_material')} mat
          ON mat.MATERIAL_ID = po.MATERIAL_ID
         AND mat.LANGUAGE_ID = 'E'
        WHERE po.PLANT_ID = :plant_id
          AND (ir.INSPECTION_RESULT_VALUATION IS NULL OR ir.INSPECTION_RESULT_VALUATION NOT LIKE 'A%')
        ORDER BY ud.USAGE_DECISION_CREATED_DATE DESC NULLS LAST
        LIMIT 200
    """
    rows = await run_sql_async(token, query, params)
    return {
        "plant_id": plant_id,
        "lot_type": lot_type,
        "fails": [_coerce_fail(row) for row in rows],
        "data_available": True,
    }
