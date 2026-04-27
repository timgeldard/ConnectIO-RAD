-- =============================================================================
-- View : connected_plant_uat.wh360.wh360_bin_stock_v
-- Phase: 1 -- direct join on raw SAP tables
-- Sources: sap.storagebin_lagp  (LAGP)
--          sap.quant_lqua       (LQUA)
-- Filter : LAGP.LGNUM IS NOT NULL
--          LQUA plant is carried through for plant-scoped stock filtering
-- Purpose: Bin-level stock summary with fill rate and shelf-life signals
-- =============================================================================

CREATE OR REPLACE VIEW connected_plant_uat.wh360.wh360_bin_stock_v AS

WITH quant_agg AS (
  -- Aggregate plant-specific quants per bin.
  SELECT
    WERKS,
    LGNUM,
    LGTYP,
    LGPLA,
    COUNT(*)                                                     AS quant_count,
    MIN(MATNR)                                                   AS material_id,
    MIN(CHARG)                                                   AS batch_id,
    SUM(GESME)                                                   AS total_stock,
    MIN(MEINS)                                                   AS uom,
    MIN(
      CASE
        WHEN VFDAT IS NOT NULL
         AND LENGTH(TRIM(VFDAT)) = 10
         AND VFDAT <> '0001-01-01'
        THEN VFDAT
        ELSE NULL
      END
    )                                                            AS earliest_expiry,
    MAX(
      CASE
        WHEN BDATU IS NOT NULL
         AND LENGTH(TRIM(BDATU)) = 10
         AND BDATU <> '0001-01-01'
        THEN BDATU
        ELSE NULL
      END
    )                                                            AS latest_gr_date
  FROM connected_plant_uat.sap.quant_lqua
  WHERE WERKS IS NOT NULL
    AND LENGTH(TRIM(WERKS)) > 0
  GROUP BY WERKS, LGNUM, LGTYP, LGPLA
)

SELECT
  lg.LGNUM                                                       AS lgnum,
  lg.LGTYP                                                       AS lgtyp,
  lg.LGPLA                                                       AS bin_id,
  q.WERKS                                                        AS plant_id,
  lg.LGBER                                                       AS section,
  lg.LPTYP                                                       AS bin_type,
  lg.KZLER                                                       AS is_empty,
  lg.SKZUA                                                       AS block_gr,
  lg.SKZUE                                                       AS block_gi,
  lg.SPGRU                                                       AS block_reason,
  COALESCE(lg.ANZQU, 0)                                          AS current_quants,
  COALESCE(lg.MAXQU, 0)                                          AS max_quants,

  -- fill_pct based on LAGP quant counters
  CASE
    WHEN COALESCE(lg.MAXQU, 0) > 0
    THEN ROUND(COALESCE(lg.ANZQU, 0) / lg.MAXQU * 100.0, 1)
    ELSE 0
  END                                                            AS fill_pct,

  -- bin_status derived from block flags and empty indicator
  CASE
    WHEN lg.KZLER = 'X'                         THEN 'free'
    WHEN lg.SPGRU IS NOT NULL
     AND LENGTH(TRIM(lg.SPGRU)) > 0             THEN 'blocked'
    WHEN lg.SKZUA = 'X' OR lg.SKZUE = 'X'      THEN 'restricted'
    ELSE 'occupied'
  END                                                            AS bin_status,

  -- quant detail from aggregated plant stock
  q.material_id,
  md.MATERIAL_NAME                                               AS material_name,
  q.batch_id,
  COALESCE(q.total_stock, 0)                                     AS total_stock,
  q.uom,
  q.earliest_expiry                                              AS expiry_date,

  CASE
    WHEN q.earliest_expiry IS NOT NULL
    THEN datediff(to_date(q.earliest_expiry, 'yyyy-MM-dd'), current_date())
    ELSE NULL
  END                                                            AS days_to_expiry,

  q.latest_gr_date                                               AS gr_date,

  CASE
    WHEN q.latest_gr_date IS NOT NULL
    THEN datediff(current_date(), to_date(q.latest_gr_date, 'yyyy-MM-dd'))
    ELSE NULL
  END                                                            AS age_days,

  COALESCE(q.quant_count, 0)                                     AS quant_count

FROM connected_plant_uat.sap.storagebin_lagp AS lg
LEFT JOIN quant_agg AS q
  ON  q.LGNUM = lg.LGNUM
  AND q.LGTYP = lg.LGTYP
  AND q.LGPLA = lg.LGPLA

LEFT JOIN connected_plant_uat.silver.silver_material_description AS md
  ON LPAD(md.MATERIAL_ID, 18, '0') = q.material_id
  AND md.LANGUAGE_ID = 'E'

WHERE lg.LGNUM IS NOT NULL
  AND LENGTH(TRIM(lg.LGNUM)) > 0
