-- Average order cycle time by production line
-- Answers: "What is the average cycle time per line?" / "Which line is slowest?"
-- Cycle time = hours from planned start to last goods receipt (actual end).
-- Only meaningful for completed orders with a goods receipt.

SELECT
  po.PLANT_ID,
  po.PRODUCTION_LINE,
  COUNT(DISTINCT po.PROCESS_ORDER_ID)  AS completed_orders,
  ROUND(
    AVG(
      TIMESTAMPDIFF(
        HOUR,
        po.START_TIMESTAMP,
        MAX(adp.DATE_TIME_OF_ENTRY)
      )
    ),
    1
  )                                    AS avg_cycle_time_hours,
  ROUND(
    AVG(
      TIMESTAMPDIFF(
        HOUR,
        po.START_TIMESTAMP,
        po.END_TIMESTAMP
      )
    ),
    1
  )                                    AS avg_planned_duration_hours
FROM connected_plant_prod.csm_process_order_history.vw_gold_process_order po
JOIN connected_plant_prod.csm_process_order_history.vw_gold_adp_movement adp
  ON adp.PROCESS_ORDER_ID = po.PROCESS_ORDER_ID
  AND adp.MOVEMENT_TYPE = 101          -- goods receipt only
  AND adp.UOM NOT IN ('EA', 'G')
WHERE po.STATUS IN ('COMPLETED', 'CLOSED')
  AND po.END_TIMESTAMP BETWEEN :start_date AND :end_date
GROUP BY po.PLANT_ID, po.PRODUCTION_LINE
ORDER BY avg_cycle_time_hours DESC
