-- =============================================================================
-- View : connected_plant_uat.wh360.wh360_kpi_snapshot_v
-- Phase: 1 -- direct queries on raw SAP tables (not via other wh360 views)
-- Sources: sap.productionorderobject_afko (AFKO)
--          sap.productionorderobject_afpo  (AFPO)
--          sap.transferorderobjects_ltak   (LTAK)
--          sap.transferorderobjects_ltap   (LTAP)
--          sap.transferrequirementobjects_ltbk (LTBK)
--          sap.deliveryobjects_likp        (LIKP)
--          sap.deliveryobjects_lips        (LIPS)
--          published_uat.central_services.procurementorderobject_ekpo (EKPO)
--          sap.storagebin_lagp             (LAGP)
-- Filter : Plant C061 applied per metric where a plant column exists
-- Purpose: Single-row KPI summary for dashboard header / tiles
-- =============================================================================

CREATE OR REPLACE VIEW connected_plant_uat.wh360.wh360_kpi_snapshot_v AS

WITH

-- -----------------------------------------------------------------------
-- Order risk classification (recomputed inline from source tables)
-- -----------------------------------------------------------------------
order_staging AS (
  SELECT
    lk.RSNUM,
    COUNT(lt.TAPOS)                                              AS to_items_total,
    COUNT(CASE WHEN lt.PQUIT = 'X' THEN 1 END) * 100.0
      / NULLIF(COUNT(lt.TAPOS), 0)                              AS staging_pct
  FROM connected_plant_uat.sap.transferorderobjects_ltak AS lk
  JOIN connected_plant_uat.sap.transferorderobjects_ltap AS lt
    ON  lt.LGNUM = lk.LGNUM
    AND lt.TANUM = lk.TANUM
  WHERE lk.RSNUM IS NOT NULL
    AND LENGTH(TRIM(lk.RSNUM)) > 0
  GROUP BY lk.RSNUM
),

order_risk AS (
  SELECT
    ak.AUFNR,
    CASE
      WHEN s.RSNUM IS NULL
        THEN 'grey'
      WHEN COALESCE(s.staging_pct, 0) < 30
       AND ak.FTRMS IS NOT NULL
       AND LENGTH(TRIM(ak.FTRMS)) = 10
       AND ak.FTRMS <> '0001-01-01'
       AND (unix_timestamp(to_date(ak.FTRMS)) - unix_timestamp()) / 60.0 < 90
        THEN 'red'
      WHEN COALESCE(s.staging_pct, 0) < 70
       AND ak.FTRMS IS NOT NULL
       AND LENGTH(TRIM(ak.FTRMS)) = 10
       AND ak.FTRMS <> '0001-01-01'
       AND (unix_timestamp(to_date(ak.FTRMS)) - unix_timestamp()) / 60.0 < 180
        THEN 'amber'
      ELSE 'green'
    END                                                          AS risk
  FROM connected_plant_uat.sap.productionorderobject_afko AS ak
  JOIN connected_plant_uat.sap.productionorderobject_afpo AS ap
    ON  ap.AUFNR = ak.AUFNR
  LEFT JOIN order_staging AS s
    ON  s.RSNUM = ak.RSNUM
  WHERE ap.PWERK = 'C061'
    AND ak.GLTRP >= date_format(date_add(current_date(), -14), 'yyyy-MM-dd')
),

-- -----------------------------------------------------------------------
-- Delivery risk classification (recomputed inline from source tables)
-- -----------------------------------------------------------------------
delivery_pick AS (
  SELECT
    VBELN,
    SUM(LFIMG)                                                   AS total_del_qty,
    SUM(LGMNG)                                                   AS total_wm_qty,
    SUM(LGMNG) * 100.0 / NULLIF(SUM(LFIMG), 0)                  AS pick_pct
  FROM connected_plant_uat.sap.deliveryobjects_lips
  GROUP BY VBELN
),

delivery_risk AS (
  SELECT
    lk.VBELN,
    CASE
      WHEN COALESCE(dp.pick_pct, 0) < 50
       AND lk.WADAT IS NOT NULL
       AND LENGTH(TRIM(lk.WADAT)) = 10
       AND lk.WADAT <> '0001-01-01'
       AND (
             unix_timestamp(to_date(lk.WADAT) + INTERVAL 1 DAY)
             - unix_timestamp()
           ) / 60.0 < 120
        THEN 'red'
      WHEN COALESCE(dp.pick_pct, 0) < 80
       AND lk.WADAT IS NOT NULL
       AND LENGTH(TRIM(lk.WADAT)) = 10
       AND lk.WADAT <> '0001-01-01'
       AND (
             unix_timestamp(to_date(lk.WADAT) + INTERVAL 1 DAY)
             - unix_timestamp()
           ) / 60.0 < 240
        THEN 'amber'
      ELSE 'green'
    END                                                          AS risk
  FROM connected_plant_uat.sap.deliveryobjects_likp AS lk
  LEFT JOIN delivery_pick AS dp
    ON dp.VBELN = lk.VBELN
  WHERE lk.WERKS = 'C061'
    AND lk.WADAT >= date_format(date_add(current_date(), -30), 'yyyy-MM-dd')
),

-- -----------------------------------------------------------------------
-- Bin metrics (no plant in LAGP; count all bins in warehouse)
-- -----------------------------------------------------------------------
bin_counts AS (
  SELECT
    COUNT(*)                                                     AS bins_total,
    COUNT(CASE WHEN KZLER = 'X' THEN 1 END)                     AS bins_free,
    COUNT(
      CASE
        WHEN (SPGRU IS NOT NULL AND LENGTH(TRIM(SPGRU)) > 0)
          OR SKZUA = 'X'
          OR SKZUE = 'X'
        THEN 1
      END
    )                                                            AS bins_blocked
  FROM connected_plant_uat.sap.storagebin_lagp
  WHERE LGNUM IS NOT NULL
    AND LENGTH(TRIM(LGNUM)) > 0
)

-- -----------------------------------------------------------------------
-- Final single-row KPI output
-- -----------------------------------------------------------------------
SELECT

  -- Process order counts (last 7 days, C061)
  (SELECT COUNT(*)         FROM order_risk)                      AS orders_total,
  (SELECT COUNT(*) FROM order_risk WHERE risk = 'red')           AS orders_red,
  (SELECT COUNT(*) FROM order_risk WHERE risk = 'amber')         AS orders_amber,

  -- Open transfer requirements (no plant filter in LTBK; all non-closed)
  (
    SELECT COUNT(*)
    FROM connected_plant_uat.sap.transferrequirementobjects_ltbk
    WHERE STATU != 'C'
      AND LGNUM IS NOT NULL
      AND LENGTH(TRIM(LGNUM)) > 0
  )                                                              AS trs_open,

  -- Open transfer orders (header not yet confirmed)
  (
    SELECT COUNT(DISTINCT lk.TANUM)
    FROM connected_plant_uat.sap.transferorderobjects_ltak AS lk
    JOIN connected_plant_uat.sap.transferorderobjects_ltap AS lt
      ON  lt.LGNUM = lk.LGNUM
      AND lt.TANUM = lk.TANUM
    WHERE lk.KQUIT != 'X'
      AND lt.WERKS = 'C061'
  )                                                              AS tos_open,

  -- Today's deliveries (C061)
  (
    SELECT COUNT(*)
    FROM connected_plant_uat.sap.deliveryobjects_likp
    WHERE WERKS = 'C061'
      AND WADAT >= date_format(date_add(current_date(), -30), 'yyyy-MM-dd')
  )                                                              AS deliveries_today,

  -- At-risk deliveries today (red + amber)
  (SELECT COUNT(*) FROM delivery_risk WHERE risk IN ('red', 'amber'))
                                                                 AS deliveries_at_risk,

  -- Open inbound PO items (C061, not final-delivered)
  (
    SELECT COUNT(*)
    FROM published_uat.central_services.procurementorderobject_ekpo
    WHERE WERKS  = 'C061'
      AND ELIKZ != 'X'
  )                                                              AS inbound_open,

  -- Blocked bins
  (SELECT bins_blocked FROM bin_counts)                          AS bins_blocked,

  -- Total bins
  (SELECT bins_total FROM bin_counts)                            AS bins_total,

  -- Bin utilisation %: (total - free) / total * 100
  (
    SELECT ROUND((bins_total - bins_free) * 100.0 / NULLIF(bins_total, 0), 1)
    FROM bin_counts
  )                                                              AS bin_util_pct
