-- Schedule adherence rate by production line for a given plant and date range
-- Answers: "Which production line has the worst on-time rate?" / "Show adherence by line"

SELECT
  sa.PLANT_ID,
  sa.PRODUCTION_LINE,
  COUNT(*)                                                          AS completed_orders,
  SUM(CASE WHEN sa.IS_ON_TIME = TRUE THEN 1 ELSE 0 END)           AS on_time_orders,
  ROUND(
    100.0 * SUM(CASE WHEN sa.IS_ON_TIME = TRUE THEN 1 ELSE 0 END)
    / NULLIF(COUNT(*), 0), 1
  )                                                                  AS on_time_pct,
  ROUND(
    100.0 * SUM(CASE WHEN sa.IS_OTIF = TRUE THEN 1 ELSE 0 END)
    / NULLIF(COUNT(*), 0), 1
  )                                                                  AS otif_pct,
  ROUND(AVG(sa.DELAY_DAYS), 1)                                     AS avg_delay_days,
  ROUND(AVG(sa.QTY_VARIANCE_PCT), 1)                               AS avg_qty_variance_pct
FROM connected_plant_prod.csm_process_order_history.metric_schedule_adherence sa
WHERE sa.ACTUAL_END_DATE BETWEEN :start_date AND :end_date
  AND sa.PLANT_ID = :plant_id       -- remove this line to see all plants
GROUP BY sa.PLANT_ID, sa.PRODUCTION_LINE
ORDER BY on_time_pct ASC
