-- Production yield by material over a date range
-- Answers: "What is the yield per material?" / "Which materials have low yield?"
-- Yield = actual goods receipts (movement type 101) / planned order quantity × 100.
-- Excludes EA and G UOMs (not volume units).

SELECT
  po.MATERIAL_ID,
  COALESCE(m.MATERIAL_NAME, po.MATERIAL_ID)          AS material_name,
  po.PLANT_ID,
  COUNT(DISTINCT po.PROCESS_ORDER_ID)                 AS order_count,
  SUM(po.QUANTITY)                                    AS total_planned_qty,
  SUM(CASE WHEN adp.MOVEMENT_TYPE = 101 THEN adp.QUANTITY ELSE 0 END)
                                                      AS total_actual_qty,
  MAX(po.UOM)                                         AS uom,
  ROUND(
    100.0 * SUM(CASE WHEN adp.MOVEMENT_TYPE = 101 THEN adp.QUANTITY ELSE 0 END)
    / NULLIF(SUM(po.QUANTITY), 0),
    1
  )                                                   AS yield_pct
FROM connected_plant_prod.csm_process_order_history.vw_gold_process_order po
LEFT JOIN connected_plant_prod.csm_process_order_history.vw_gold_adp_movement adp
  ON adp.PROCESS_ORDER_ID = po.PROCESS_ORDER_ID
  AND adp.MOVEMENT_TYPE IN (101, 261)
  AND adp.UOM NOT IN ('EA', 'G')
LEFT JOIN connected_plant_prod.csm_process_order_history.vw_gold_material m
  ON m.MATERIAL_ID = po.MATERIAL_ID
  AND m.LANGUAGE_ID = 'E'
WHERE po.STATUS IN ('COMPLETED', 'CLOSED')
  AND po.END_TIMESTAMP BETWEEN :start_date AND :end_date
  AND po.STATUS != 'CANCELLED'
GROUP BY po.MATERIAL_ID, m.MATERIAL_NAME, po.PLANT_ID
ORDER BY yield_pct ASC
