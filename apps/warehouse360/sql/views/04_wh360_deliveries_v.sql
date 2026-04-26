-- =============================================================================
-- View : connected_plant_uat.wh360.wh360_deliveries_v
-- Phase: 1 -- direct join on raw SAP tables
-- Sources: sap.deliveryobjects_likp (LIKP)
--          sap.deliveryobjects_lips (LIPS)
-- Filter : LIKP.WERKS = 'C061'
--          Planned GI date (WADAT) >= yesterday
-- Purpose: Outbound delivery header with pick progress and shipment risk signal
-- =============================================================================

CREATE OR REPLACE VIEW connected_plant_uat.wh360.wh360_deliveries_v AS

WITH

cust AS (
  SELECT CUSTOMER_ID, MIN(CUSTOMER_NAME) AS CUSTOMER_NAME
  FROM connected_plant_uat.gold.gold_customer
  GROUP BY CUSTOMER_ID
),

pick_progress AS (
  -- Per-delivery pick completion: WM qty confirmed vs delivery qty
  SELECT
    VBELN,
    COUNT(*)                                                     AS line_count,
    COALESCE(SUM(LFIMG), 0)                                      AS total_del_qty,
    COALESCE(SUM(LGMNG), 0)                                      AS total_wm_qty,
    SUM(LGMNG) * 100.0 / NULLIF(SUM(LFIMG), 0)                  AS pick_pct
  FROM connected_plant_uat.sap.deliveryobjects_lips
  GROUP BY VBELN
)

SELECT
  lk.VBELN                                                       AS delivery_id,
  lk.LFART                                                       AS delivery_type,
  lk.WERKS                                                       AS plant_id,
  lk.KUNAG                                                       AS customer_id,
  gc.CUSTOMER_NAME                                               AS customer_name,
  lk.ROUTE                                                       AS carrier,
  lk.LGNUM                                                       AS lgnum,
  lk.WADAT                                                       AS planned_gi_date,
  lk.WADAT_IST                                                   AS actual_gi_date,
  lk.LDDAT                                                       AS loading_date,
  lk.LFDAT                                                       AS delivery_date,
  lk.BTGEW                                                       AS gross_weight,
  lk.GEWEI                                                       AS weight_uom,
  lk.ANZPK                                                       AS packages,
  lk.VLSTK                                                       AS wm_status,

  -- mins_to_cutoff: minutes until end of planned GI day (midnight of WADAT + 1)
  CASE
    WHEN lk.WADAT IS NOT NULL
     AND LENGTH(TRIM(lk.WADAT)) = 10
     AND lk.WADAT <> '0001-01-01'
    THEN (
           unix_timestamp(to_date(lk.WADAT) + INTERVAL 1 DAY)
           - unix_timestamp()
         ) / 60.0
    ELSE NULL
  END                                                            AS mins_to_cutoff,

  COALESCE(pp.pick_pct, 0)                                       AS pick_pct,
  COALESCE(pp.line_count, 0)                                     AS line_count,

  -- risk signal: red/amber/green based on pick progress vs time to cutoff
  CASE
    WHEN COALESCE(pp.pick_pct, 0) < 50
     AND lk.WADAT IS NOT NULL
     AND LENGTH(TRIM(lk.WADAT)) = 10
     AND lk.WADAT <> '0001-01-01'
     AND (
           unix_timestamp(to_date(lk.WADAT) + INTERVAL 1 DAY)
           - unix_timestamp()
         ) / 60.0 < 120
      THEN 'red'
    WHEN COALESCE(pp.pick_pct, 0) < 80
     AND lk.WADAT IS NOT NULL
     AND LENGTH(TRIM(lk.WADAT)) = 10
     AND lk.WADAT <> '0001-01-01'
     AND (
           unix_timestamp(to_date(lk.WADAT) + INTERVAL 1 DAY)
           - unix_timestamp()
         ) / 60.0 < 240
      THEN 'amber'
    ELSE 'green'
  END                                                            AS risk,

  -- shipped: actual GI date is populated and non-empty
  CASE
    WHEN lk.WADAT_IST IS NOT NULL
     AND LENGTH(TRIM(lk.WADAT_IST)) > 0
     AND lk.WADAT_IST <> '0001-01-01'
    THEN TRUE
    ELSE FALSE
  END                                                            AS shipped

FROM connected_plant_uat.sap.deliveryobjects_likp AS lk
LEFT JOIN pick_progress AS pp
  ON pp.VBELN = lk.VBELN

LEFT JOIN cust AS gc ON gc.CUSTOMER_ID = lk.KUNAG

WHERE lk.WERKS = 'C061'
  AND lk.WADAT >= date_format(date_add(current_date(), -30), 'yyyy-MM-dd')
