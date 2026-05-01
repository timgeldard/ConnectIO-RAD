-- Open / in-progress process orders
-- Answers: "What orders are currently running?" / "What is on the production floor right now?"
-- Filter by PLANT_ID or PRODUCTION_LINE to scope to a site or line.

SELECT
  po.PROCESS_ORDER_ID,
  po.MATERIAL_ID,
  COALESCE(m.MATERIAL_NAME, po.MATERIAL_ID) AS material_name,
  po.PLANT_ID,
  po.STATUS,
  po.START_TIMESTAMP,
  po.END_TIMESTAMP,
  po.QUANTITY        AS planned_qty,
  po.UOM
FROM connected_plant_prod.csm_process_order_history.vw_gold_process_order po
LEFT JOIN connected_plant_prod.csm_process_order_history.vw_gold_material m
  ON m.MATERIAL_ID = po.MATERIAL_ID
  AND m.LANGUAGE_ID = 'E'
WHERE po.STATUS IN ('IN PROGRESS', 'Tulip Load In Progress')
ORDER BY po.START_TIMESTAMP DESC
