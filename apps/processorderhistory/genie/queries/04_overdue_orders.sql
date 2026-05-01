-- Currently overdue process orders (released/in-progress, past planned end)
-- Answers: "Which orders are overdue?" / "What is late right now?"
-- Returns active orders where END_TIMESTAMP is in the past and order is not completed.

SELECT
  po.PROCESS_ORDER_ID,
  po.MATERIAL_ID,
  COALESCE(m.MATERIAL_NAME, po.MATERIAL_ID)       AS material_name,
  po.PLANT_ID,
  po.STATUS,
  po.START_TIMESTAMP,
  po.END_TIMESTAMP                                  AS planned_end,
  DATEDIFF(CURRENT_TIMESTAMP(), po.END_TIMESTAMP)  AS days_overdue,
  po.QUANTITY                                       AS planned_qty,
  po.UOM
FROM connected_plant_prod.csm_process_order_history.vw_gold_process_order po
LEFT JOIN connected_plant_prod.csm_process_order_history.vw_gold_material m
  ON m.MATERIAL_ID = po.MATERIAL_ID
  AND m.LANGUAGE_ID = 'E'
WHERE po.STATUS NOT IN ('COMPLETED', 'CLOSED', 'CANCELLED')
  AND po.END_TIMESTAMP < CURRENT_TIMESTAMP()
ORDER BY days_overdue DESC
