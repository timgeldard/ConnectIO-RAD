-- =============================================================================
-- View : ${TRACE_CATALOG}.wh360.wh360_near_expiry_batches_v
-- Sources: sap.quant_lqua                          (LQUA)
--          ${PUBLISHED_CATALOG}.central_services.batches_mcha (MCHA)
--          silver.silver_material_description
--          gold.gold_plant
-- Grain : (MATNR, CHARG, WERKS) — one row per batch–plant combination with stock
-- Purpose: Batch-level near-expiry list with manufacture date, expiry date,
--          total WM stock, and aged-stock signal (days since last quant movement).
--          Filtered to batches expiring within 90 days from today.
--          Interim / handover storage types excluded (stock in transit).
-- Deploy: No dependencies on other wh360 views; deploy independently
-- =============================================================================

CREATE OR REPLACE VIEW ${TRACE_CATALOG}.wh360.wh360_near_expiry_batches_v AS

WITH quant_by_batch AS (
  SELECT
    MATNR,
    CHARG,
    WERKS,
    SUM(GESME)                                                       AS total_stock,
    MIN(MEINS)                                                       AS uom,
    -- Earliest expiry date across all bins for this batch/plant
    MIN(
      CASE
        WHEN VFDAT IS NOT NULL
         AND LENGTH(TRIM(VFDAT)) = 10
         AND VFDAT <> '0001-01-01'
        THEN VFDAT
        ELSE NULL
      END
    )                                                                AS expiry_date,
    -- Most recent GR / creation date — best available proxy for last movement
    MAX(
      CASE
        WHEN BDATU IS NOT NULL
         AND LENGTH(TRIM(BDATU)) = 10
         AND BDATU <> '0001-01-01'
        THEN BDATU
        ELSE NULL
      END
    )                                                                AS last_movement_date
  FROM ${TRACE_CATALOG}.sap.quant_lqua
  WHERE GESME > 0
    AND WERKS IS NOT NULL
    AND LENGTH(TRIM(WERKS)) > 0
    AND MATNR IS NOT NULL
    AND LENGTH(TRIM(MATNR)) > 0
    AND CHARG IS NOT NULL
    AND LENGTH(TRIM(CHARG)) > 0
    -- Exclude interim / handover bins (stock in mid-transfer)
    AND LGTYP NOT IN ('0910', '0921', '0922', '0930')
  GROUP BY MATNR, CHARG, WERKS
),

-- Keep only batches with a valid expiry date within the 90-day window
near_expiry AS (
  SELECT *
  FROM quant_by_batch
  WHERE expiry_date IS NOT NULL
    AND datediff(to_date(expiry_date, 'yyyy-MM-dd'), current_date()) <= 90
)

SELECT
  q.MATNR                                                            AS material_id,
  COALESCE(md.MATERIAL_NAME, q.MATNR)                              AS material_name,
  q.CHARG                                                            AS batch_id,
  q.WERKS                                                            AS plant_id,
  COALESCE(gp.PLANT_NAME, q.WERKS)                                 AS plant_name,
  -- Manufacture date from MCHA batch master (NULL when not recorded in SAP)
  m.HSDAT                                                            AS manufacture_date,
  q.expiry_date,
  datediff(to_date(q.expiry_date, 'yyyy-MM-dd'), current_date())   AS days_to_expiry,
  q.total_stock,
  q.uom,
  q.last_movement_date,
  -- aged_days: how many days since this batch last moved in WM
  CASE
    WHEN q.last_movement_date IS NOT NULL
    THEN datediff(current_date(), to_date(q.last_movement_date, 'yyyy-MM-dd'))
    ELSE NULL
  END                                                                AS aged_days
FROM near_expiry AS q
LEFT JOIN ${PUBLISHED_CATALOG}.central_services.batches_mcha AS m
  ON  m.MATNR = q.MATNR
  AND m.CHARG = q.CHARG
  AND m.WERKS = q.WERKS
LEFT JOIN ${TRACE_CATALOG}.silver.silver_material_description AS md
  ON  LPAD(md.MATERIAL_ID, 18, '0') = q.MATNR
  AND md.LANGUAGE_ID = 'E'
LEFT JOIN ${TRACE_CATALOG}.gold.gold_plant AS gp
  ON  gp.PLANT_ID = q.WERKS
