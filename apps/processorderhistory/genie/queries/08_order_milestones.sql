-- Key timestamps for a specific process order
-- Answers: "What happened to process order 123456 and when?" / "Why is this order late?"
-- Shows planned vs actual start and end, duration, status, and quantity.

SELECT
  po.PROCESS_ORDER_ID,
  po.MATERIAL_ID,
  COALESCE(m.MATERIAL_NAME, po.MATERIAL_ID)                  AS material_name,
  po.PLANT_ID,
  po.STATUS,
  po.START_TIMESTAMP                                          AS planned_start,
  po.END_TIMESTAMP                                            AS planned_end,
  po.QUANTITY                                                 AS planned_qty,
  po.UOM,
  -- goods receipts (actual output)
  SUM(CASE WHEN adp.MOVEMENT_TYPE = 101 THEN adp.QUANTITY ELSE 0 END)
                                                              AS actual_qty,
  MIN(CASE WHEN adp.MOVEMENT_TYPE = 101 THEN adp.DATE_TIME_OF_ENTRY END)
                                                              AS first_goods_receipt,
  MAX(CASE WHEN adp.MOVEMENT_TYPE = 101 THEN adp.DATE_TIME_OF_ENTRY END)
                                                              AS last_goods_receipt,
  -- pours (component issues)
  COUNT(CASE WHEN adp.MOVEMENT_TYPE = 261 THEN 1 END)        AS pour_count,
  SUM(CASE WHEN adp.MOVEMENT_TYPE = 261 THEN adp.QUANTITY ELSE 0 END)
                                                              AS total_poured_qty,
  MIN(CASE WHEN adp.MOVEMENT_TYPE = 261 THEN adp.DATE_TIME_OF_ENTRY END)
                                                              AS first_pour,
  MAX(CASE WHEN adp.MOVEMENT_TYPE = 261 THEN adp.DATE_TIME_OF_ENTRY END)
                                                              AS last_pour,
  -- delay
  DATEDIFF(
    COALESCE(
      MAX(CASE WHEN adp.MOVEMENT_TYPE = 101 THEN adp.DATE_TIME_OF_ENTRY END),
      CURRENT_TIMESTAMP()
    ),
    po.END_TIMESTAMP
  )                                                           AS delay_days
FROM connected_plant_prod.csm_process_order_history.vw_gold_process_order po
LEFT JOIN connected_plant_prod.csm_process_order_history.vw_gold_adp_movement adp
  ON adp.PROCESS_ORDER_ID = po.PROCESS_ORDER_ID
  AND adp.UOM NOT IN ('EA', 'G')
LEFT JOIN connected_plant_prod.csm_process_order_history.vw_gold_material m
  ON m.MATERIAL_ID = po.MATERIAL_ID
  AND m.LANGUAGE_ID = 'E'
WHERE po.PROCESS_ORDER_ID = :process_order_id
GROUP BY po.PROCESS_ORDER_ID, po.MATERIAL_ID, m.MATERIAL_NAME,
         po.PLANT_ID, po.STATUS, po.START_TIMESTAMP, po.END_TIMESTAMP,
         po.QUANTITY, po.UOM
