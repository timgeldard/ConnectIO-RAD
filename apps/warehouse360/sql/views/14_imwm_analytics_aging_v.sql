-- =============================================================================
-- View : ${TRACE_CATALOG}.wh360.imwm_analytics_aging_v
-- Sources: ${PUBLISHED_CATALOG}.central_services.batches_mcha (MCHA)
--          sap.storagelocationmaterial_mard             (MARD)
--          sap.materialvaluation_mbew                   (MBEW)
-- Grain : (plant_id, age_bucket)
-- Purpose: Inventory aging distribution for the Analytics tab aging chart
-- Notes : Age is derived from MCHA.HSDAT (manufacture date, VARCHAR 'yyyy-MM-dd').
--         For materials with multiple batches, the oldest batch HSDAT determines
--         the age bucket — this is an intentional simplification for v1.
--         Sentinel value '0001-01-01' in HSDAT is excluded.
-- =============================================================================

CREATE OR REPLACE VIEW ${TRACE_CATALOG}.wh360.imwm_analytics_aging_v AS

WITH

-- -----------------------------------------------------------------------
-- Oldest batch per material/plant (proxy for material age)
-- -----------------------------------------------------------------------
batch_ages AS (
  SELECT
    MATNR,
    WERKS,
    MIN(HSDAT)                                                     AS oldest_batch_date
  FROM ${PUBLISHED_CATALOG}.central_services.batches_mcha
  WHERE (LVORM IS NULL OR LVORM = '')
    AND MATNR IS NOT NULL
    AND LENGTH(TRIM(MATNR)) > 0
    AND WERKS IS NOT NULL
    AND LENGTH(TRIM(WERKS)) > 0
    AND HSDAT IS NOT NULL
    AND LENGTH(TRIM(HSDAT)) = 10
    AND HSDAT <> '0001-01-01'
    -- Reject malformed HSDAT values that match the length check but aren't
    -- parseable dates — without this, age_days falls through as NULL and
    -- the row gets misclassified into the >180d bucket.
    AND TRY_CAST(HSDAT AS DATE) IS NOT NULL
  GROUP BY MATNR, WERKS
),

-- -----------------------------------------------------------------------
-- Valued IM stock: unrestricted only (LABST), priced via MBEW
-- -----------------------------------------------------------------------
valued_stock AS (
  SELECT
    m.MATNR                                                        AS material_id,
    m.WERKS                                                        AS plant_id,
    m.LABST                                                        AS unrestricted_qty,
    CASE
      WHEN mb.VPRSV = 'S' AND NULLIF(mb.PEINH, 0) IS NOT NULL
        THEN COALESCE(mb.STPRS, 0) * m.LABST / mb.PEINH
      WHEN NULLIF(mb.PEINH, 0) IS NOT NULL
        THEN COALESCE(mb.VERPR, 0) * m.LABST / mb.PEINH
      ELSE 0
    END                                                            AS value_eur,
    datediff(
      current_date(),
      to_date(ba.oldest_batch_date, 'yyyy-MM-dd')
    )                                                              AS age_days
  FROM ${TRACE_CATALOG}.sap.storagelocationmaterial_mard AS m
  JOIN batch_ages AS ba
    ON  ba.MATNR = m.MATNR
    AND ba.WERKS = m.WERKS
  LEFT JOIN ${TRACE_CATALOG}.sap.materialvaluation_mbew AS mb
    ON  mb.MATNR = m.MATNR
    AND mb.BWKEY = m.WERKS
    AND (mb.BWTAR = '' OR mb.BWTAR IS NULL)
  WHERE m.LABST > 0
    AND m.WERKS IS NOT NULL
    AND LENGTH(TRIM(m.WERKS)) > 0
    AND (m.LVORM IS NULL OR m.LVORM = '')
),

-- -----------------------------------------------------------------------
-- Age bucketing
-- -----------------------------------------------------------------------
bucketed AS (
  SELECT
    plant_id,
    material_id,
    unrestricted_qty,
    value_eur,
    CASE
      WHEN age_days <= 30  THEN '0-30d'
      WHEN age_days <= 60  THEN '31-60d'
      WHEN age_days <= 90  THEN '61-90d'
      WHEN age_days <= 180 THEN '91-180d'
      ELSE '>180d'
    END                                                            AS age_bucket,
    CASE
      WHEN age_days <= 30  THEN 1
      WHEN age_days <= 60  THEN 2
      WHEN age_days <= 90  THEN 3
      WHEN age_days <= 180 THEN 4
      ELSE 5
    END                                                            AS age_bucket_order
  FROM valued_stock
)

SELECT
  plant_id,
  age_bucket,
  age_bucket_order,
  COUNT(DISTINCT material_id)                                      AS material_count,
  ROUND(SUM(value_eur), 2)                                        AS total_value_eur
FROM bucketed
GROUP BY plant_id, age_bucket, age_bucket_order
ORDER BY plant_id, age_bucket_order
