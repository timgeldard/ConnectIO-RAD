-- Daily pour volume (component issues into process orders)
-- Answers: "How much was poured today/this week?" / "Show daily pour volume by line"
-- A pour = movement type 261 in vw_gold_adp_movement.
-- Reversal movements (262) are excluded.
-- UOM filtered to KG/L — excludes EA (each) and G (grams).

SELECT
  DATE(adp.DATE_TIME_OF_ENTRY)        AS pour_date,
  po.PLANT_ID,
  po.PRODUCTION_LINE,
  COUNT(DISTINCT adp.PROCESS_ORDER_ID) AS order_count,
  COUNT(*)                             AS pour_events,
  ROUND(SUM(adp.QUANTITY), 1)         AS total_poured_qty,
  MAX(adp.UOM)                         AS uom
FROM connected_plant_prod.csm_process_order_history.vw_gold_adp_movement adp
JOIN connected_plant_prod.csm_process_order_history.vw_gold_process_order po
  ON po.PROCESS_ORDER_ID = adp.PROCESS_ORDER_ID
WHERE adp.MOVEMENT_TYPE = 261            -- pours only, not reversals
  AND adp.UOM NOT IN ('EA', 'G')
  AND adp.DATE_TIME_OF_ENTRY BETWEEN :start_date AND :end_date
GROUP BY DATE(adp.DATE_TIME_OF_ENTRY), po.PLANT_ID, po.PRODUCTION_LINE
ORDER BY pour_date DESC, po.PRODUCTION_LINE
