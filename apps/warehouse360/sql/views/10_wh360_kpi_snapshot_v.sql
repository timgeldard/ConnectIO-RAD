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
--          sap.quant_lqua                  (LQUA)
-- Purpose: Plant-level KPI summary for dashboard header / tiles
-- =============================================================================

CREATE OR REPLACE VIEW connected_plant_uat.wh360.wh360_kpi_snapshot_v AS

WITH

plant_scope AS (
  SELECT DISTINCT PWERK AS plant_id
  FROM connected_plant_uat.sap.productionorderobject_afpo
  WHERE PWERK IS NOT NULL
    AND LENGTH(TRIM(PWERK)) > 0

  UNION

  SELECT DISTINCT WERKS AS plant_id
  FROM connected_plant_uat.sap.transferorderobjects_ltap
  WHERE WERKS IS NOT NULL
    AND LENGTH(TRIM(WERKS)) > 0

  UNION

  SELECT DISTINCT WERKS AS plant_id
  FROM connected_plant_uat.sap.deliveryobjects_likp
  WHERE WERKS IS NOT NULL
    AND LENGTH(TRIM(WERKS)) > 0

  UNION

  SELECT DISTINCT WERKS AS plant_id
  FROM published_uat.central_services.procurementorderobject_ekpo
  WHERE WERKS IS NOT NULL
    AND LENGTH(TRIM(WERKS)) > 0

  UNION

  SELECT DISTINCT WERKS AS plant_id
  FROM connected_plant_uat.sap.quant_lqua
  WHERE WERKS IS NOT NULL
    AND LENGTH(TRIM(WERKS)) > 0
),

-- -----------------------------------------------------------------------
-- Order risk classification (recomputed inline from source tables)
-- -----------------------------------------------------------------------
order_staging AS (
  SELECT
    lk.RSNUM,
    COUNT(lt.TAPOS)                                             AS to_items_total,
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
    ap.PWERK                                                     AS plant_id,
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
  WHERE ap.PWERK IS NOT NULL
    AND LENGTH(TRIM(ap.PWERK)) > 0
    AND ak.GLTRP >= date_format(date_add(current_date(), -14), 'yyyy-MM-dd')
),

order_counts AS (
  SELECT
    plant_id,
    COUNT(*)                                                     AS orders_total,
    COUNT(CASE WHEN risk = 'red' THEN 1 END)                    AS orders_red,
    COUNT(CASE WHEN risk = 'amber' THEN 1 END)                  AS orders_amber
  FROM order_risk
  GROUP BY plant_id
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
    lk.WERKS                                                     AS plant_id,
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
  WHERE lk.WERKS IS NOT NULL
    AND LENGTH(TRIM(lk.WERKS)) > 0
    AND lk.WADAT >= date_format(date_add(current_date(), -30), 'yyyy-MM-dd')
),

delivery_counts AS (
  SELECT
    plant_id,
    COUNT(*)                                                     AS deliveries_today,
    COUNT(CASE WHEN risk IN ('red', 'amber') THEN 1 END)        AS deliveries_at_risk
  FROM delivery_risk
  GROUP BY plant_id
),

-- -----------------------------------------------------------------------
-- WM and inbound metrics
-- -----------------------------------------------------------------------
open_transfer_orders AS (
  SELECT
    lt.WERKS                                                     AS plant_id,
    COUNT(DISTINCT lk.TANUM)                                     AS tos_open
  FROM connected_plant_uat.sap.transferorderobjects_ltak AS lk
  JOIN connected_plant_uat.sap.transferorderobjects_ltap AS lt
    ON  lt.LGNUM = lk.LGNUM
    AND lt.TANUM = lk.TANUM
  WHERE lk.KQUIT != 'X'
    AND lt.WERKS IS NOT NULL
    AND LENGTH(TRIM(lt.WERKS)) > 0
  GROUP BY lt.WERKS
),

open_transfer_requirements AS (
  SELECT
    ap.PWERK                                                     AS plant_id,
    COUNT(DISTINCT tr.RSNUM)                                     AS trs_open
  FROM connected_plant_uat.sap.transferrequirementobjects_ltbk AS tr
  JOIN connected_plant_uat.sap.productionorderobject_afko AS ak
    ON ak.RSNUM = tr.RSNUM
  JOIN connected_plant_uat.sap.productionorderobject_afpo AS ap
    ON ap.AUFNR = ak.AUFNR
  WHERE tr.STATU != 'C'
    AND tr.LGNUM IS NOT NULL
    AND LENGTH(TRIM(tr.LGNUM)) > 0
    AND ap.PWERK IS NOT NULL
    AND LENGTH(TRIM(ap.PWERK)) > 0
  GROUP BY ap.PWERK
),

inbound_counts AS (
  SELECT
    WERKS                                                        AS plant_id,
    COUNT(*)                                                     AS inbound_open
  FROM published_uat.central_services.procurementorderobject_ekpo
  WHERE WERKS IS NOT NULL
    AND LENGTH(TRIM(WERKS)) > 0
    AND ELIKZ != 'X'
  GROUP BY WERKS
),

-- -----------------------------------------------------------------------
-- Plant-scoped bin metrics. LAGP has no plant, so this scopes to bins with
-- plant-specific quant activity and joins bin master attributes where present.
-- -----------------------------------------------------------------------
bin_counts AS (
  SELECT
    q.WERKS                                                      AS plant_id,
    COUNT(DISTINCT CONCAT(q.LGNUM, '|', q.LGTYP, '|', q.LGPLA)) AS bins_total,
    COUNT(
      DISTINCT CASE
        WHEN q.GESME > 0
        THEN CONCAT(q.LGNUM, '|', q.LGTYP, '|', q.LGPLA)
      END
    )                                                            AS bins_occupied,
    COUNT(
      DISTINCT CASE
        WHEN (lg.SPGRU IS NOT NULL AND LENGTH(TRIM(lg.SPGRU)) > 0)
          OR lg.SKZUA = 'X'
          OR lg.SKZUE = 'X'
        THEN CONCAT(q.LGNUM, '|', q.LGTYP, '|', q.LGPLA)
      END
    )                                                            AS bins_blocked
  FROM connected_plant_uat.sap.quant_lqua AS q
  LEFT JOIN connected_plant_uat.sap.storagebin_lagp AS lg
    ON  lg.LGNUM = q.LGNUM
    AND lg.LGTYP = q.LGTYP
    AND lg.LGPLA = q.LGPLA
  WHERE q.WERKS IS NOT NULL
    AND LENGTH(TRIM(q.WERKS)) > 0
  GROUP BY q.WERKS
)

-- -----------------------------------------------------------------------
-- Final plant-level KPI output
-- -----------------------------------------------------------------------
SELECT
  ps.plant_id,
  COALESCE(oc.orders_total, 0)                                   AS orders_total,
  COALESCE(oc.orders_red, 0)                                     AS orders_red,
  COALESCE(oc.orders_amber, 0)                                   AS orders_amber,
  COALESCE(otr.trs_open, 0)                                      AS trs_open,
  COALESCE(oto.tos_open, 0)                                      AS tos_open,
  COALESCE(dc.deliveries_today, 0)                               AS deliveries_today,
  COALESCE(dc.deliveries_at_risk, 0)                             AS deliveries_at_risk,
  COALESCE(ic.inbound_open, 0)                                   AS inbound_open,
  COALESCE(bc.bins_blocked, 0)                                   AS bins_blocked,
  COALESCE(bc.bins_total, 0)                                     AS bins_total,
  COALESCE(ROUND(bc.bins_occupied * 100.0 / NULLIF(bc.bins_total, 0), 1), 0)
                                                                  AS bin_util_pct
FROM plant_scope AS ps
LEFT JOIN order_counts AS oc
  ON oc.plant_id = ps.plant_id
LEFT JOIN open_transfer_requirements AS otr
  ON otr.plant_id = ps.plant_id
LEFT JOIN open_transfer_orders AS oto
  ON oto.plant_id = ps.plant_id
LEFT JOIN delivery_counts AS dc
  ON dc.plant_id = ps.plant_id
LEFT JOIN inbound_counts AS ic
  ON ic.plant_id = ps.plant_id
LEFT JOIN bin_counts AS bc
  ON bc.plant_id = ps.plant_id
