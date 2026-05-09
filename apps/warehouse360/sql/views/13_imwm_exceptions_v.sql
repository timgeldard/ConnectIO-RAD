-- =============================================================================
-- View : ${TRACE_CATALOG}.wh360.imwm_exceptions_v
-- Sources: sap.storagelocationmaterial_mard (MARD)
--          sap.quant_lqua                   (LQUA)
--          sap.transferorderobjects_ltak    (LTAK)
--          ${PUBLISHED_CATALOG}.central_services.batches_mcha (MCHA)
--          ${TRACE_CATALOG}.wh360.imwm_stock_comparison_v (view 11)
-- Grain : one row per exception instance
-- Purpose: Rule-generated exception queue for the Exceptions tab
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
  MATNR                                                            AS material_id,
  WERKS                                                            AS plant_id,
  LGORT                                                            AS storage_loc,
  CONCAT(
    'IM stock negative: LABST=', COALESCE(CAST(LABST AS STRING), '0'),
    ' INSME=', COALESCE(CAST(INSME AS STRING), '0')
  )                                                                AS detail_text,
  current_date()                                                   AS detected_date
FROM ${TRACE_CATALOG}.sap.storagelocationmaterial_mard
WHERE (LVORM IS NULL OR LVORM = '')
  AND WERKS IS NOT NULL
  AND LENGTH(TRIM(WERKS)) > 0
  AND (LABST < 0 OR INSME < 0)

UNION ALL

-- Rule 2: Negative WM quant (SEV 4, SLA 2h)
SELECT
  'NEGATIVE_WM_QUANT'                                              AS exception_type,
  4                                                                AS severity,
  2                                                                AS sla_hours,
  MATNR                                                            AS material_id,
  WERKS                                                            AS plant_id,
  LGTYP                                                            AS storage_loc,
  CONCAT(
    'WM quant negative: bin ', LGTYP, '-', LGPLA,
    ' qty=', CAST(GESME AS STRING)
  )                                                                AS detail_text,
  current_date()                                                   AS detected_date
FROM ${TRACE_CATALOG}.sap.quant_lqua
WHERE WERKS IS NOT NULL
  AND LENGTH(TRIM(WERKS)) > 0
  AND GESME < 0

UNION ALL

-- Rule 3: Expired batch with unrestricted IM stock (SEV 3, SLA 8h)
SELECT
  'EXPIRED_BATCH_WITH_STOCK'                                       AS exception_type,
  3                                                                AS severity,
  8                                                                AS sla_hours,
  mc.MATNR                                                         AS material_id,
  m.WERKS                                                          AS plant_id,
  m.LGORT                                                          AS storage_loc,
  CONCAT(
    'Batch ', mc.CHARG, ' expired ', mc.VFDAT,
    '; unrestricted stock=', CAST(m.LABST AS STRING)
  )                                                                AS detail_text,
  current_date()                                                   AS detected_date
FROM ${PUBLISHED_CATALOG}.central_services.batches_mcha AS mc
JOIN ${TRACE_CATALOG}.sap.storagelocationmaterial_mard AS m
  ON  m.MATNR = mc.MATNR
  AND m.WERKS = mc.WERKS
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
  plant_id,
  storage_loc,
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
  lt.WERKS                                                         AS plant_id,
  NULL                                                             AS storage_loc,
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
  MATNR                                                            AS material_id,
  WERKS                                                            AS plant_id,
  LGORT                                                            AS storage_loc,
  CONCAT(
    'QI qty=', CAST(INSME AS STRING),
    ' last movement period ', LFGJA, '/', LFMON
  )                                                                AS detail_text,
  current_date()                                                   AS detected_date
FROM ${TRACE_CATALOG}.sap.storagelocationmaterial_mard
WHERE (LVORM IS NULL OR LVORM = '')
  AND WERKS IS NOT NULL
  AND LENGTH(TRIM(WERKS)) > 0
  AND INSME > 0
  AND LFGJA IS NOT NULL AND LFGJA <> '0000' AND LENGTH(TRIM(LFGJA)) = 4
  AND LFMON IS NOT NULL AND LFMON <> '000' AND LENGTH(TRIM(LFMON)) >= 1
  AND datediff(
    current_date(),
    to_date(CONCAT(LFGJA, '-', LPAD(CAST(TRY_CAST(TRIM(LFMON) AS INT) AS STRING), 2, '0'), '-01'), 'yyyy-MM-dd')
  ) > 14

UNION ALL

-- Rule 7: Blocked stock aged > 3d (SEV 1, SLA 0)
-- Same month-precision approximation via LFGJA/LFMON
SELECT
  'BLOCKED_STOCK_AGED_3D'                                          AS exception_type,
  1                                                                AS severity,
  0                                                                AS sla_hours,
  MATNR                                                            AS material_id,
  WERKS                                                            AS plant_id,
  LGORT                                                            AS storage_loc,
  CONCAT(
    'Blocked qty=', CAST(SPEME AS STRING),
    ' last movement period ', LFGJA, '/', LFMON
  )                                                                AS detail_text,
  current_date()                                                   AS detected_date
FROM ${TRACE_CATALOG}.sap.storagelocationmaterial_mard
WHERE (LVORM IS NULL OR LVORM = '')
  AND WERKS IS NOT NULL
  AND LENGTH(TRIM(WERKS)) > 0
  AND SPEME > 0
  AND LFGJA IS NOT NULL AND LFGJA <> '0000' AND LENGTH(TRIM(LFGJA)) = 4
  AND LFMON IS NOT NULL AND LFMON <> '000' AND LENGTH(TRIM(LFMON)) >= 1
  AND datediff(
    current_date(),
    to_date(CONCAT(LFGJA, '-', LPAD(CAST(TRY_CAST(TRIM(LFMON) AS INT) AS STRING), 2, '0'), '-01'), 'yyyy-MM-dd')
  ) > 3
