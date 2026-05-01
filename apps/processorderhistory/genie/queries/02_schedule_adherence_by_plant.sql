-- Schedule adherence rate by plant for a date range
-- Answers: "What is the on-time completion rate per plant this month?"
-- Replace the date literals with the desired range, or let Genie parameterise them.
-- metric_schedule_adherence contains completed orders only.

SELECT
  sa.PLANT_ID,
  COUNT(*)                                                          AS completed_orders,
  SUM(CASE WHEN sa.IS_ON_TIME = TRUE THEN 1 ELSE 0 END)           AS on_time_orders,
  SUM(CASE WHEN sa.IS_IN_FULL = TRUE THEN 1 ELSE 0 END)           AS in_full_orders,
  SUM(CASE WHEN sa.IS_OTIF = TRUE THEN 1 ELSE 0 END)              AS otif_orders,
  ROUND(
    100.0 * SUM(CASE WHEN sa.IS_ON_TIME = TRUE THEN 1 ELSE 0 END)
    / NULLIF(COUNT(*), 0), 1
  )                                                                  AS on_time_pct,
  ROUND(
    100.0 * SUM(CASE WHEN sa.IS_OTIF = TRUE THEN 1 ELSE 0 END)
    / NULLIF(COUNT(*), 0), 1
  )                                                                  AS otif_pct,
  ROUND(AVG(CASE WHEN sa.DELAY_DAYS > 0 THEN sa.DELAY_DAYS END), 1) AS avg_delay_days_late
FROM connected_plant_prod.csm_process_order_history.metric_schedule_adherence sa
WHERE sa.ACTUAL_END_DATE BETWEEN :start_date AND :end_date
GROUP BY sa.PLANT_ID
ORDER BY on_time_pct ASC
