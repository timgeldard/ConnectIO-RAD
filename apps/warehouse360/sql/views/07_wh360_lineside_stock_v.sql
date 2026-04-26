-- =============================================================================
-- View : connected_plant_uat.wh360.wh360_lineside_stock_v
-- Phase: 1 -- direct query on raw SAP table
-- Sources: sap.quant_lqua (LQUA)
-- Filter : LQUA.WERKS = 'C061' AND q.GESME > 0
--          Storage types: all except 990 and 999 (interim/virtual types)
--          NOTE: Production supply types at C061 are typically KP, VB, PA.
--          The LGTYP NOT IN ('990','999') filter is a safe starting point;
--          refine to site-specific lineside types in Phase 2 configuration.
-- Purpose: Live stock in production supply / lineside bins for replenishment view
-- =============================================================================

CREATE OR REPLACE VIEW connected_plant_uat.wh360.wh360_lineside_stock_v AS

SELECT
  q.LGNUM                                                          AS lgnum,
  q.LGTYP                                                          AS storage_type,
  q.LGPLA                                                          AS bin_id,
  q.MATNR                                                          AS material_id,
  q.CHARG                                                          AS batch_id,
  q.WERKS                                                          AS plant_id,
  q.LGORT                                                          AS storage_loc,
  q.GESME                                                          AS total_stock,
  q.VERME                                                          AS available,
  q.MEINS                                                          AS uom,
  q.VFDAT                                                          AS expiry_date,
  q.BDATU                                                          AS gr_date,

  -- days_to_expiry: NULL when VFDAT is absent or invalid
  CASE
    WHEN VFDAT IS NOT NULL
     AND LENGTH(TRIM(VFDAT)) = 10
     AND VFDAT <> '0001-01-01'
    THEN datediff(to_date(VFDAT, 'yyyy-MM-dd'), current_date())
    ELSE NULL
  END                                                            AS days_to_expiry,

  -- age_days: days since goods receipt, NULL when BDATU absent or invalid
  CASE
    WHEN BDATU IS NOT NULL
     AND LENGTH(TRIM(BDATU)) = 10
     AND BDATU <> '0001-01-01'
    THEN datediff(current_date(), to_date(BDATU, 'yyyy-MM-dd'))
    ELSE NULL
  END                                                            AS age_days,

  q.BENUM                                                          AS ref_doc,
  q.BETYP                                                          AS ref_type,
  md.MATERIAL_NAME                                               AS material_name

FROM connected_plant_uat.sap.quant_lqua AS q
LEFT JOIN connected_plant_uat.silver.silver_material_description AS md
  ON LPAD(md.MATERIAL_ID, 18, '0') = q.MATNR
  AND md.LANGUAGE_ID = 'E'


WHERE q.WERKS = 'C061'
  AND q.GESME > 0
  AND q.LGTYP NOT IN ('990', '999')
