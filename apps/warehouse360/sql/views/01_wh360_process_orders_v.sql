-- =============================================================================
-- View : connected_plant_uat.wh360.wh360_process_orders_v
-- Phase: 1 -- direct join on raw SAP tables
-- Sources: sap.productionorderobject_afko (AFKO)
--          sap.productionorderobject_afpo (AFPO)
--          sap.transferorderobjects_ltak  (LTAK)
--          sap.transferorderobjects_ltap  (LTAP)
-- Filter : AFPO.PWERK = 'C061'
--          Planned finish (GLTRP) >= yesterday
-- Purpose: Active process orders with staging progress and risk signal
-- =============================================================================

CREATE OR REPLACE VIEW connected_plant_uat.wh360.wh360_process_orders_v AS

WITH staging AS (
  -- Aggregate WM transfer order progress per reservation number
  SELECT
    lk.RSNUM,
    COUNT(lt.TAPOS)                                              AS to_items_total,
    COUNT(CASE WHEN lt.PQUIT = 'X' THEN 1 END)                  AS to_items_done,
    COUNT(CASE WHEN lt.PQUIT = 'X' THEN 1 END) * 100.0
      / NULLIF(COUNT(lt.TAPOS), 0)                              AS staging_pct
  FROM connected_plant_uat.sap.transferorderobjects_ltak  AS lk
  JOIN connected_plant_uat.sap.transferorderobjects_ltap  AS lt
    ON  lt.LGNUM = lk.LGNUM
    AND lt.TANUM = lk.TANUM
  WHERE lk.RSNUM IS NOT NULL
    AND LENGTH(TRIM(lk.RSNUM)) > 0
  GROUP BY lk.RSNUM
),

orders AS (
  SELECT
    ak.AUFNR,
    ak.GSTRP,
    ak.GLTRP,
    ak.FTRMS,
    ak.FTRMI,
    ak.GAMNG,
    ak.GMEIN,
    ak.RSNUM,
    ap.MATNR,
    ap.PWERK,
    ap.PSAMG,
    ap.MEINS,
    ap.CHARG,
    ap.LGORT
  FROM connected_plant_uat.sap.productionorderobject_afko AS ak
  JOIN connected_plant_uat.sap.productionorderobject_afpo AS ap
    ON  ap.AUFNR = ak.AUFNR
  WHERE ap.PWERK = 'C061'
    AND ak.GLTRP >= date_format(date_add(current_date(), -14), 'yyyy-MM-dd')
)

SELECT
  o.AUFNR                                                        AS order_id,
  o.MATNR                                                        AS material_id,
  o.PWERK                                                        AS plant_id,
  o.PSAMG                                                        AS order_qty,
  o.MEINS                                                        AS uom,
  md.MATERIAL_NAME                                               AS material_name,
  o.GSTRP                                                        AS planned_start,
  o.GLTRP                                                        AS planned_finish,
  o.FTRMS                                                        AS sched_start,
  o.FTRMI                                                        AS sched_finish,
  COALESCE(s.staging_pct, 0)                                     AS staging_pct,
  COALESCE(s.to_items_total, 0)                                  AS to_items_total,
  COALESCE(s.to_items_done, 0)                                   AS to_items_done,

  -- mins_to_start: NULL when FTRMS is absent, zero, or not a valid date
  CASE
    WHEN o.FTRMS IS NOT NULL
     AND LENGTH(TRIM(o.FTRMS)) = 10
     AND o.FTRMS <> '0001-01-01'
    THEN (unix_timestamp(to_date(o.FTRMS)) - unix_timestamp()) / 60.0
    ELSE NULL
  END                                                            AS mins_to_start,

  -- risk: grey=no TOs linked; red/amber/green by staging_pct vs mins_to_start
  CASE
    WHEN s.RSNUM IS NULL
      THEN 'grey'
    WHEN COALESCE(s.staging_pct, 0) < 30
     AND o.FTRMS IS NOT NULL
     AND LENGTH(TRIM(o.FTRMS)) = 10
     AND o.FTRMS <> '0001-01-01'
     AND (unix_timestamp(to_date(o.FTRMS)) - unix_timestamp()) / 60.0 < 90
      THEN 'red'
    WHEN COALESCE(s.staging_pct, 0) < 70
     AND o.FTRMS IS NOT NULL
     AND LENGTH(TRIM(o.FTRMS)) = 10
     AND o.FTRMS <> '0001-01-01'
     AND (unix_timestamp(to_date(o.FTRMS)) - unix_timestamp()) / 60.0 < 180
      THEN 'amber'
    ELSE 'green'
  END                                                            AS risk,

  o.RSNUM                                                        AS reservation_no,
  o.CHARG                                                        AS batch_id,
  o.AUFNR                                                        AS sap_order

FROM orders AS o
LEFT JOIN staging AS s
  ON s.RSNUM = o.RSNUM
LEFT JOIN connected_plant_uat.silver.silver_material_description AS md
  ON LPAD(md.MATERIAL_ID, 18, '0') = o.MATNR
  AND md.LANGUAGE_ID = 'E'

