-- =============================================================================
-- View : connected_plant_uat.wh360.imwm_stock_comparison_v
-- Sources: sap.storagelocationmaterial_mard   (MARD)
--          sap.materialmaster_mara            (MARA)
--          sap.materialvaluation_mbew         (MBEW)
--          sap.quant_lqua                     (LQUA)
--          sap.transferorderobjects_ltak      (LTAK)
--          sap.transferorderobjects_ltap      (LTAP)
--          published_uat.central_services.batches_mcha (MCHA)
--          silver.silver_material_description
--          gold.gold_plant
--          gold.gold_storage
-- Grain : (MATNR, WERKS, LGORT) — one row per IM storage location record
-- Purpose: Core IM vs WM stock comparison; powers IM Explorer, Reconciliation,
--          Overview KPIs, and is referenced by imwm_exceptions_v (view 13)
-- Deploy: Run after all wh360_*.sql views; view 13 depends on this view
-- =============================================================================

CREATE OR REPLACE VIEW connected_plant_uat.wh360.imwm_stock_comparison_v AS

WITH

-- -----------------------------------------------------------------------
-- IM book stock from MARD; outer-joined to pricing, master data, names
-- -----------------------------------------------------------------------
im_stock AS (
  SELECT
    m.MATNR,
    m.WERKS,
    m.LGORT,
    COALESCE(m.LABST, 0)                                           AS unrestricted,
    COALESCE(m.INSME, 0)                                           AS qi,
    COALESCE(m.SPEME, 0)                                           AS blocked,
    COALESCE(m.EINME, 0)                                           AS restricted,
    COALESCE(m.UMLME, 0)                                           AS in_transfer,
    COALESCE(m.LABST, 0) + COALESCE(m.INSME, 0)
      + COALESCE(m.SPEME, 0) + COALESCE(m.EINME, 0)
      + COALESCE(m.UMLME, 0)                                       AS im_total,
    ma.MTART,
    ma.MEINS,
    mb.VPRSV,
    mb.STPRS,
    mb.VERPR,
    NULLIF(COALESCE(mb.PEINH, 0), 0)                              AS peinh,
    gs.STORAGE_NAME,
    gp.PLANT_NAME
  FROM connected_plant_uat.sap.storagelocationmaterial_mard AS m
  LEFT JOIN connected_plant_uat.sap.materialmaster_mara AS ma
    ON ma.MATNR = m.MATNR
  LEFT JOIN connected_plant_uat.sap.materialvaluation_mbew AS mb
    ON  mb.MATNR = m.MATNR
    AND mb.BWKEY = m.WERKS
    AND (mb.BWTAR = '' OR mb.BWTAR IS NULL)
  LEFT JOIN connected_plant_uat.gold.gold_storage AS gs
    ON  gs.PLANT_ID = m.WERKS
    AND gs.STORAGE_ID = m.LGORT
  LEFT JOIN connected_plant_uat.gold.gold_plant AS gp
    ON gp.PLANT_ID = m.WERKS
  WHERE m.WERKS IS NOT NULL
    AND LENGTH(TRIM(m.WERKS)) > 0
    AND m.MATNR IS NOT NULL
    AND LENGTH(TRIM(m.MATNR)) > 0
    AND (m.LVORM IS NULL OR m.LVORM = '')
),

-- -----------------------------------------------------------------------
-- WM physical stock — standard storage types only (excludes interim/handover)
-- -----------------------------------------------------------------------
wm_stock AS (
  SELECT
    MATNR,
    WERKS,
    SUM(GESME)                                                     AS wm_total
  FROM connected_plant_uat.sap.quant_lqua
  WHERE WERKS IS NOT NULL
    AND LENGTH(TRIM(WERKS)) > 0
    AND LGTYP NOT IN ('0921', '0922', '0930', '0910')
  GROUP BY MATNR, WERKS
),

-- -----------------------------------------------------------------------
-- Interim / handover bins (IM→WM boundary; stock partially transacted)
-- -----------------------------------------------------------------------
interim_stock AS (
  SELECT
    MATNR,
    WERKS,
    SUM(GESME)                                                     AS interim_total
  FROM connected_plant_uat.sap.quant_lqua
  WHERE WERKS IS NOT NULL
    AND LENGTH(TRIM(WERKS)) > 0
    AND LGTYP IN ('0921', '0922', '0930')
  GROUP BY MATNR, WERKS
),

-- -----------------------------------------------------------------------
-- Batch counts per material/plant — MCHA is cross-plant in central_services
-- -----------------------------------------------------------------------
batch_counts AS (
  SELECT
    MATNR,
    WERKS,
    COUNT(DISTINCT CHARG)                                          AS batch_count
  FROM published_uat.central_services.batches_mcha
  WHERE (LVORM IS NULL OR LVORM = '')
    AND MATNR IS NOT NULL
    AND LENGTH(TRIM(MATNR)) > 0
    AND WERKS IS NOT NULL
    AND LENGTH(TRIM(WERKS)) > 0
  GROUP BY MATNR, WERKS
),

-- -----------------------------------------------------------------------
-- Open transfer orders per material/plant (KQUIT = '' means unconfirmed)
-- -----------------------------------------------------------------------
open_tos AS (
  SELECT
    lt.MATNR,
    lt.WERKS,
    COUNT(DISTINCT lk.TANUM)                                       AS open_to_count
  FROM connected_plant_uat.sap.transferorderobjects_ltak AS lk
  JOIN connected_plant_uat.sap.transferorderobjects_ltap AS lt
    ON  lt.LGNUM = lk.LGNUM
    AND lt.TANUM = lk.TANUM
  WHERE (lk.KQUIT = '' OR lk.KQUIT IS NULL)
    AND lt.WERKS IS NOT NULL
    AND LENGTH(TRIM(lt.WERKS)) > 0
    AND lt.MATNR IS NOT NULL
  GROUP BY lt.MATNR, lt.WERKS
),

-- -----------------------------------------------------------------------
-- Material descriptions — MATERIAL_ID in silver is without leading zeros
-- -----------------------------------------------------------------------
mat_desc AS (
  SELECT
    LPAD(MATERIAL_ID, 18, '0')                                     AS matnr_padded,
    MATERIAL_NAME
  FROM connected_plant_uat.silver.silver_material_description
  WHERE LANGUAGE_ID = 'E'
),

-- -----------------------------------------------------------------------
-- Base: join IM stock with WM, interim, batches, open TOs, descriptions
-- -----------------------------------------------------------------------
base AS (
  SELECT
    im.MATNR                                                       AS material_id,
    COALESCE(md.MATERIAL_NAME, im.MATNR)                          AS material_name,
    im.MTART                                                       AS material_type,
    im.MEINS                                                       AS uom,
    im.WERKS                                                       AS plant_id,
    COALESCE(im.PLANT_NAME, im.WERKS)                             AS plant_name,
    im.LGORT                                                       AS storage_loc,
    COALESCE(im.STORAGE_NAME, im.LGORT)                           AS storage_loc_name,
    im.unrestricted                                                AS unrestricted_qty,
    im.qi                                                          AS qi_qty,
    im.blocked                                                     AS blocked_qty,
    im.restricted                                                  AS restricted_qty,
    COALESCE(ist.interim_total, 0)                                 AS interim_qty,
    im.im_total                                                    AS im_total_qty,
    COALESCE(wm.wm_total, 0) + COALESCE(ist.interim_total, 0)     AS wm_total_qty,
    COALESCE(wm.wm_total, 0) + COALESCE(ist.interim_total, 0)
      - im.im_total                                                AS delta_qty,
    CASE
      WHEN im.VPRSV = 'S' AND im.peinh IS NOT NULL
        THEN ROUND(im.STPRS * im.im_total / im.peinh, 2)
      WHEN im.peinh IS NOT NULL
        THEN ROUND(COALESCE(im.VERPR, 0) * im.im_total / im.peinh, 2)
      ELSE 0
    END                                                            AS inventory_value_eur,
    COALESCE(bc.batch_count, 0)                                    AS batch_count,
    COALESCE(ot.open_to_count, 0)                                  AS open_tos
  FROM im_stock AS im
  LEFT JOIN wm_stock AS wm
    ON  wm.MATNR = im.MATNR
    AND wm.WERKS = im.WERKS
  LEFT JOIN interim_stock AS ist
    ON  ist.MATNR = im.MATNR
    AND ist.WERKS = im.WERKS
  LEFT JOIN batch_counts AS bc
    ON  bc.MATNR = im.MATNR
    AND bc.WERKS = im.WERKS
  LEFT JOIN open_tos AS ot
    ON  ot.MATNR = im.MATNR
    AND ot.WERKS = im.WERKS
  LEFT JOIN mat_desc AS md
    ON md.matnr_padded = im.MATNR
),

-- -----------------------------------------------------------------------
-- Mismatch classification: match → timing → true (in that priority order)
-- -----------------------------------------------------------------------
with_mismatch AS (
  SELECT
    *,
    CASE
      WHEN ABS(delta_qty) <= im_total_qty * 0.01 OR im_total_qty = 0
        THEN 'match'
      WHEN open_tos > 0 OR interim_qty > 0
        THEN 'timing'
      ELSE 'true'
    END                                                            AS mismatch_kind
  FROM base
),

-- -----------------------------------------------------------------------
-- ABC classification — cumulative value rank within plant
-- Rows with zero/null value fall into class C by default
-- -----------------------------------------------------------------------
with_abc_rank AS (
  SELECT
    *,
    SUM(inventory_value_eur) OVER (
      PARTITION BY plant_id
      ORDER BY inventory_value_eur DESC
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) / NULLIF(SUM(inventory_value_eur) OVER (PARTITION BY plant_id), 0)
                                                                   AS cumulative_value_pct
  FROM with_mismatch
)

SELECT
  material_id,
  material_name,
  material_type,
  uom,
  plant_id,
  plant_name,
  storage_loc,
  storage_loc_name,
  unrestricted_qty,
  qi_qty,
  blocked_qty,
  restricted_qty,
  interim_qty,
  im_total_qty,
  wm_total_qty,
  delta_qty,
  inventory_value_eur,
  batch_count,
  open_tos,
  mismatch_kind,
  CASE
    WHEN COALESCE(cumulative_value_pct, 1.0) <= 0.80 THEN 'A'
    WHEN COALESCE(cumulative_value_pct, 1.0) <= 0.95 THEN 'B'
    ELSE 'C'
  END                                                              AS abc_class
FROM with_abc_rank
