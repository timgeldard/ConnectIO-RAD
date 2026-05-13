"""Data-access helpers for the ConnectedQuality Lab Board."""
from typing import Optional

from connectedquality_backend.db import run_sql_async, sql_param, tbl


async def fetch_lab_failure_rows(token: str, *, plant_id: str, lot_type: Optional[str] = None) -> list[dict]:
    """Fetch rejected or warning inspection characteristics for the Lab Board.

    Args:
        token: Databricks access token forwarded from the request.
        plant_id: Plant identifier selected by the user or platform session.
        lot_type: Optional SAP inspection lot type filter.

    Returns:
        List of raw warehouse rows containing process order, inspection lot,
        characteristic, valuation, material, and line context.
    """
    params = [sql_param("plant_id", plant_id)]
    lot_type_clause = ""
    if lot_type:
        params.append(sql_param("lot_type", lot_type))
        lot_type_clause = "AND po.INSPECTION_LOT_TYPE = :lot_type"

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
        FROM {tbl('vw_gold_inspection_result')} ir
        JOIN {tbl('vw_gold_process_order')} po
          ON po.PROCESS_ORDER_ID = ir.PROCESS_ORDER_ID
        LEFT JOIN {tbl('vw_gold_process_order_plan')} plan
          ON plan.PROCESS_ORDER_ID = po.PROCESS_ORDER_ID
        LEFT JOIN {tbl('vw_gold_process_order_material')} pom
          ON pom.PROCESS_ORDER_ID = po.PROCESS_ORDER_ID
         AND pom.MATERIAL_ID = po.MATERIAL_ID
        LEFT JOIN {tbl('vw_gold_inspection_usage_decision')} ud
          ON ud.INSPECTION_LOT_ID = po.INSPECTION_LOT_ID
        LEFT JOIN {tbl('vw_gold_inspection_specification')} spec
          ON spec.INSPECTION_CHARACTERISTIC_ID = ir.INSPECTION_CHARACTERISTIC_ID
         AND spec.INSPECTION_OPERATION_ID = ir.INSPECTION_OPERATION_ID
        LEFT JOIN {tbl('vw_gold_material')} mat
          ON mat.MATERIAL_ID = po.MATERIAL_ID
         AND mat.LANGUAGE_ID = 'E'
        WHERE po.PLANT_ID = :plant_id
          {lot_type_clause}
          AND (ir.INSPECTION_RESULT_VALUATION IS NULL OR ir.INSPECTION_RESULT_VALUATION NOT LIKE 'A%')
        ORDER BY ud.USAGE_DECISION_CREATED_DATE DESC NULLS LAST
        LIMIT 200
    """
    return await run_sql_async(token, query, params)


async def fetch_lab_plants(token: str) -> list[dict]:
    """Return all plants from the gold plant dimension table.

    Args:
        token: Databricks access token forwarded from the request.

    Returns:
        List of ``{plant_id, plant_name}`` dicts ordered by ``plant_id``.
    """
    from connectedquality_backend.db import CQ_CATALOG
    q = f"""
        SELECT
            PLANT_ID   AS plant_id,
            PLANT_NAME AS plant_name
        FROM `{CQ_CATALOG}`.`gold`.`gold_plant`
        WHERE PLANT_ID IS NOT NULL
        ORDER BY PLANT_ID
    """
    return await run_sql_async(token, q)
