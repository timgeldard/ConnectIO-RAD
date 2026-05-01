-- OEE trend by production line over a date range
-- Answers: "What is the OEE trend for line X?" / "Show OEE by line this month"
-- Uses weighted average when aggregating across multiple lines.
-- Excludes days with no scheduled production (SCHEDULED_MINUTES = 0).

SELECT
  oee.PRODUCTION_DATE,
  oee.PLANT_ID,
  oee.PRODUCTION_LINE,
  ROUND(oee.OEE_PCT, 1)           AS oee_pct,
  ROUND(oee.AVAILABILITY_PCT, 1)  AS availability_pct,
  ROUND(oee.PERFORMANCE_PCT, 1)   AS performance_pct,
  ROUND(oee.QUALITY_PCT, 1)       AS quality_pct,
  oee.SCHEDULED_MINUTES,
  oee.DOWNTIME_MINUTES,
  ROUND(
    100.0 * oee.DOWNTIME_MINUTES / NULLIF(oee.SCHEDULED_MINUTES, 0),
    1
  )                               AS downtime_rate_pct
FROM connected_plant_prod.csm_process_order_history.metric_oee_daily oee
WHERE oee.PRODUCTION_DATE BETWEEN :start_date AND :end_date
  AND oee.SCHEDULED_MINUTES > 0
  AND oee.PLANT_ID = :plant_id    -- remove to see all plants
ORDER BY oee.PRODUCTION_LINE, oee.PRODUCTION_DATE
