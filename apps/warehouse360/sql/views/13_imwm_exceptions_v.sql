-- =============================================================================
-- View : ${TRACE_CATALOG}.wh360.imwm_exceptions_v
-- Sources: sap.storagelocationmaterial_mard (MARD)
--          sap.quant_lqua                   (LQUA)
--          sap.transferorderobjects_ltak    (LTAK)
--          ${PUBLISHED_CATALOG}.central_services.batches_mcha (MCHA)
--          silver.silver_material_description
--          gold.gold_storage
--          ${TRACE_CATALOG}.wh360.imwm_stock_comparison_v (view 11)
-- Grain : one row per exception instance
-- Purpose: Rule-generated exception queue for the Exceptions tab
-- Columns added vs v1: material_name, storage_loc_name, qty, batch_id, bin_id
-- Notes : QI/blocked aging rules (rules 6–7) use LFGJA/LFMON (fiscal period
--         strings) as a month-precision proxy for last movement date. Days
--         computed from the 1st of that fiscal period month.
--         View 11 (imwm_stock_comparison_v) must be deployed before this view.
-- =============================================================================

CREATE OR REPLACE VIEW ${TRACE_CATALOG}.wh360.imwm_exceptions_v AS

-- Rule 1: Negative IM stock (SEV 4, SLA 2h)
SELECT
  'NEGATIVE_IM_STOCK'                                              AS exception_type,
  4                                                                AS severity,
  2                                                                AS sla_hours,
  m.MATNR                                                          AS material_id,
  COALESCE(md.MATERIAL_NAME, m.MATNR)                            AS material_name,
  m.WERKS                                                          AS plant_id,
  m.LGORT                                                          AS storage_loc,
  COALESCE(gs.STORAGE_NAME, m.LGORT)                             AS storage_loc_name,
  LEAST(COALESCE(m.LABST, 0), COALESCE(m.INSME, 0))             AS qty,
  NULL                                                             AS batch_id,
  NULL                                                             AS bin_id,
  CONCAT(
    'IM stock negative: LABST=', COALESCE(CAST(m.LABST AS STRING), '0'),
    ' INSME=', COALESCE(CAST(m.INSME AS STRING), '0')
  )                                                                AS detail_text,
  current_date()                                                   AS detected_date
FROM ${TRACE_CATALOG}.sap.storagelocationmaterial_mard AS m
LEFT JOIN ${TRACE_CATALOG}.silver.silver_material_description AS md
  ON  LPAD(md.MATERIAL_ID, 18, '0') = m.MATNR
  AND md.LANGUAGE_ID = 'E'
LEFT JOIN ${TRACE_CATALOG}.gold.gold_storage AS gs
  ON  gs.PLANT_ID = m.WERKS
  AND gs.STORAGE_ID = m.LGORT
WHERE (m.LVORM IS NULL OR m.LVORM = '')
  AND m.WERKS IS NOT NULL
  AND LENGTH(TRIM(m.WERKS)) > 0
  AND (m.LABST < 0 OR m.INSME < 0)

UNION ALL

-- Rule 2: Negative WM quant (SEV 4, SLA 2h)
SELECT
  'NEGATIVE_WM_QUANT'                                              AS exception_type,
  4                                                                AS severity,
  2                                                                AS sla_hours,
  q.MATNR                                                          AS material_id,
  COALESCE(md.MATERIAL_NAME, q.MATNR)                            AS material_name,
  q.WERKS                                                          AS plant_id,
  q.LGTYP                                                          AS storage_loc,
  NULL                                                             AS storage_loc_name,
  q.GESME                                                          AS qty,
  q.CHARG                                                          AS batch_id,
  q.LGPLA                                                          AS bin_id,
  CONCAT(
    'WM quant negative: bin ', q.LGTYP, '-', q.LGPLA,
    ' qty=', CAST(q.GESME AS STRING)
  )                                                                AS detail_text,
  current_date()                                                   AS detected_date
FROM ${TRACE_CATALOG}.sap.quant_lqua AS q
LEFT JOIN ${TRACE_CATALOG}.silver.silver_material_description AS md
  ON  LPAD(md.MATERIAL_ID, 18, '0') = q.MATNR
  AND md.LANGUAGE_ID = 'E'
WHERE q.WERKS IS NOT NULL
  AND LENGTH(TRIM(q.WERKS)) > 0
  AND q.GESME < 0

UNION ALL

-- Rule 3: Expired batch with unrestricted IM stock (SEV 3, SLA 8h)
SELECT
  'EXPIRED_BATCH_WITH_STOCK'                                       AS exception_type,
  3                                                                AS severity,
  8                                                                AS sla_hours,
  mc.MATNR                                                         AS material_id,
  COALESCE(md.MATERIAL_NAME, mc.MATNR)                           AS material_name,
  m.WERKS                                                          AS plant_id,
  m.LGORT                                                          AS storage_loc,
  COALESCE(gs.STORAGE_NAME, m.LGORT)                             AS storage_loc_name,
  m.LABST                                                          AS qty,
  mc.CHARG                                                         AS batch_id,
  NULL                                                             AS bin_id,
  CONCAT(
    'Batch ', mc.CHARG, ' expired ', mc.VFDAT,
    '; unrestricted stock=', CAST(m.LABST AS STRING)
  )                                                                AS detail_text,
  current_date()                                                   AS detected_date
FROM ${PUBLISHED_CATALOG}.central_services.batches_mcha AS mc
JOIN ${TRACE_CATALOG}.sap.storagelocationmaterial_mard AS m
  ON  m.MATNR = mc.MATNR
  AND m.WERKS = mc.WERKS
LEFT JOIN ${TRACE_CATALOG}.silver.silver_material_description AS md
  ON  LPAD(md.MATERIAL_ID, 18, '0') = mc.MATNR
  AND md.LANGUAGE_ID = 'E'
LEFT JOIN ${TRACE_CATALOG}.gold.gold_storage AS gs
  ON  gs.PLANT_ID = m.WERKS
  AND gs.STORAGE_ID = m.LGORT
WHERE (mc.LVORM IS NULL OR mc.LVORM = '')
  AND mc.VFDAT IS NOT NULL
  AND LENGTH(TRIM(mc.VFDAT)) = 10
  AND mc.VFDAT <> '0001-01-01'
  AND to_date(mc.VFDAT, 'yyyy-MM-dd') < current_date()
  AND m.LABST > 0
  AND (m.LVORM IS NULL OR m.LVORM = '')
  AND m.WERKS IS NOT NULL
  AND LENGTH(TRIM(m.WERKS)) > 0

UNION ALL

-- Rule 4: IM/WM true variance (SEV 3, SLA 24h) — sourced from view 11
SELECT
  'IM_WM_TRUE_VARIANCE'                                            AS exception_type,
  3                                                                AS severity,
  24                                                               AS sla_hours,
  material_id,
  material_name,
  plant_id,
  storage_loc,
  storage_loc_name,
  delta_qty                                                        AS qty,
  NULL                                                             AS batch_id,
  NULL                                                             AS bin_id,
  CONCAT(
    'Delta: ', CAST(ROUND(delta_qty, 2) AS STRING),
    ' ', uom,
    ' (IM=', CAST(ROUND(im_total_qty, 2) AS STRING),
    ' WM=', CAST(ROUND(wm_total_qty, 2) AS STRING), ')'
  )                                                                AS detail_text,
  current_date()                                                   AS detected_date
FROM ${TRACE_CATALOG}.wh360.imwm_stock_comparison_v
WHERE mismatch_kind = 'true'

UNION ALL

-- Rule 5: Open transfer order aged > 24h (SEV 2, SLA 0)
SELECT
  'OPEN_TO_AGED_24H'                                               AS exception_type,
  2                                                                AS severity,
  0                                                                AS sla_hours,
  NULL                                                             AS material_id,
  NULL                                                             AS material_name,
  lt.WERKS                                                         AS plant_id,
  NULL                                                             AS storage_loc,
  NULL                                                             AS storage_loc_name,
  NULL                                                             AS qty,
  NULL                                                             AS batch_id,
  NULL                                                             AS bin_id,
  CONCAT(
    'TO ', lk.TANUM, ' open since ', lk.BDATU,
    ' (', datediff(current_date(), to_date(lk.BDATU, 'yyyy-MM-dd')), 'd)'
  )                                                                AS detail_text,
  current_date()                                                   AS detected_date
FROM ${TRACE_CATALOG}.sap.transferorderobjects_ltak AS lk
JOIN ${TRACE_CATALOG}.sap.transferorderobjects_ltap AS lt
  ON  lt.LGNUM = lk.LGNUM
  AND lt.TANUM = lk.TANUM
WHERE (lk.KQUIT = '' OR lk.KQUIT IS NULL)
  AND lk.BDATU IS NOT NULL
  AND LENGTH(TRIM(lk.BDATU)) = 10
  AND lk.BDATU <> '0001-01-01'
  AND to_date(lk.BDATU, 'yyyy-MM-dd') < date_add(current_date(), -1)
  AND lt.WERKS IS NOT NULL
  AND LENGTH(TRIM(lt.WERKS)) > 0

UNION ALL

-- Rule 6: QI stock aged > 14d (SEV 2, SLA 0)
-- LFGJA/LFMON are fiscal year/period strings; age is month-precision from period start
SELECT
  'QI_STOCK_AGED_14D'                                              AS exception_type,
  2                                                                AS severity,
  0                                                                AS sla_hours,
  m.MATNR                                                          AS material_id,
  COALESCE(md.MATERIAL_NAME, m.MATNR)                            AS material_name,
  m.WERKS                                                          AS plant_id,
  m.LGORT                                                          AS storage_loc,
  COALESCE(gs.STORAGE_NAME, m.LGORT)                             AS storage_loc_name,
  m.INSME                                                          AS qty,
  NULL                                                             AS batch_id,
  NULL                                                             AS bin_id,
  CONCAT(
    'QI qty=', CAST(m.INSME AS STRING),
    ' last movement period ', m.LFGJA, '/', m.LFMON
  )                                                                AS detail_text,
  current_date()                                                   AS detected_date
FROM ${TRACE_CATALOG}.sap.storagelocationmaterial_mard AS m
LEFT JOIN ${TRACE_CATALOG}.silver.silver_material_description AS md
  ON  LPAD(md.MATERIAL_ID, 18, '0') = m.MATNR
  AND md.LANGUAGE_ID = 'E'
LEFT JOIN ${TRACE_CATALOG}.gold.gold_storage AS gs
  ON  gs.PLANT_ID = m.WERKS
  AND gs.STORAGE_ID = m.LGORT
WHERE (m.LVORM IS NULL OR m.LVORM = '')
  AND m.WERKS IS NOT NULL
  AND LENGTH(TRIM(m.WERKS)) > 0
  AND m.INSME > 0
  AND m.LFGJA IS NOT NULL AND m.LFGJA <> '0000' AND LENGTH(TRIM(m.LFGJA)) = 4
  AND m.LFMON IS NOT NULL AND m.LFMON <> '000' AND LENGTH(TRIM(m.LFMON)) >= 1
  AND datediff(
    current_date(),
    to_date(CONCAT(m.LFGJA, '-', LPAD(CAST(TRY_CAST(TRIM(m.LFMON) AS INT) AS STRING), 2, '0'), '-01'), 'yyyy-MM-dd')
  ) > 14

UNION ALL

-- Rule 7: Blocked stock aged > 3d (SEV 1, SLA 0)
-- Same month-precision approximation via LFGJA/LFMON
SELECT
  'BLOCKED_STOCK_AGED_3D'                                          AS exception_type,
  1                                                                AS severity,
  0                                                                AS sla_hours,
  m.MATNR                                                          AS material_id,
  COALESCE(md.MATERIAL_NAME, m.MATNR)                            AS material_name,
  m.WERKS                                                          AS plant_id,
  m.LGORT                                                          AS storage_loc,
  COALESCE(gs.STORAGE_NAME, m.LGORT)                             AS storage_loc_name,
  m.SPEME                                                          AS qty,
  NULL                                                             AS batch_id,
  NULL                                                             AS bin_id,
  CONCAT(
    'Blocked qty=', CAST(m.SPEME AS STRING),
    ' last movement period ', m.LFGJA, '/', m.LFMON
  )                                                                AS detail_text,
  current_date()                                                   AS detected_date
FROM ${TRACE_CATALOG}.sap.storagelocationmaterial_mard AS m
LEFT JOIN ${TRACE_CATALOG}.silver.silver_material_description AS md
  ON  LPAD(md.MATERIAL_ID, 18, '0') = m.MATNR
  AND md.LANGUAGE_ID = 'E'
LEFT JOIN ${TRACE_CATALOG}.gold.gold_storage AS gs
  ON  gs.PLANT_ID = m.WERKS
  AND gs.STORAGE_ID = m.LGORT
WHERE (m.LVORM IS NULL OR m.LVORM = '')
  AND m.WERKS IS NOT NULL
  AND LENGTH(TRIM(m.WERKS)) > 0
  AND m.SPEME > 0
  AND m.LFGJA IS NOT NULL AND m.LFGJA <> '0000' AND LENGTH(TRIM(m.LFGJA)) = 4
  AND m.LFMON IS NOT NULL AND m.LFMON <> '000' AND LENGTH(TRIM(m.LFMON)) >= 1
  AND datediff(
    current_date(),
    to_date(CONCAT(m.LFGJA, '-', LPAD(CAST(TRY_CAST(TRIM(m.LFMON) AS INT) AS STRING), 2, '0'), '-01'), 'yyyy-MM-dd')
  ) > 3
