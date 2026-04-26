-- =============================================================================
-- View : connected_plant_uat.wh360.wh360_dispensary_tasks_v
-- Phase: 1 -- direct join on raw SAP tables
-- Sources: sap.reservationrequirement_resb (RESB)
--          sap.productionorderobject_afko  (AFKO)
-- Filter : RESB.WERKS = 'C061'
--          RESB.BWART = '261' (production consumption movement type)
--          RESB.XLOEK != 'X'  (not deleted)
--          Open qty > 0       (BDMNG > ENMNG)
--          NOTE: Further filtering by material type / group for dispensary-
--          relevant materials should be added in Phase 2 based on site config.
-- Purpose: Outstanding dispensary pick tasks for production orders
-- =============================================================================

CREATE OR REPLACE VIEW connected_plant_uat.wh360.wh360_dispensary_tasks_v AS

SELECT
  r.RSNUM                                                        AS reservation_no,
  r.RSPOS                                                        AS item_no,
  r.AUFNR                                                        AS order_id,
  r.MATNR                                                        AS material_id,
  r.WERKS                                                        AS plant_id,
  r.LGORT                                                        AS storage_loc,
  r.BDMNG                                                        AS required_qty,
  COALESCE(r.ENMNG, 0)                                           AS withdrawn_qty,
  r.MEINS                                                        AS uom,
  r.BDMNG - COALESCE(r.ENMNG, 0)                                AS open_qty,
  r.BDTER                                                        AS requirement_date,
  r.BWART                                                        AS movement_type,
  r.RSART                                                        AS reservation_type,
  r.CHARG                                                        AS batch_id,

  -- Order scheduling dates from AFKO (NULL for reservations not linked to an order)
  md.MATERIAL_NAME                                               AS material_name,
  ak.GSTRP                                                       AS planned_start,
  ak.FTRMS                                                       AS sched_start,

  -- mins_to_start: NULL when FTRMS is absent or not a valid date
  CASE
    WHEN ak.FTRMS IS NOT NULL
     AND LENGTH(TRIM(ak.FTRMS)) = 10
     AND ak.FTRMS <> '0001-01-01'
    THEN (unix_timestamp(to_date(ak.FTRMS)) - unix_timestamp()) / 60.0
    ELSE NULL
  END                                                            AS mins_to_start

FROM connected_plant_uat.sap.reservationrequirement_resb AS r
LEFT JOIN connected_plant_uat.sap.productionorderobject_afko AS ak
  ON  ak.AUFNR = r.AUFNR
LEFT JOIN connected_plant_uat.silver.silver_material_description AS md
  ON LPAD(md.MATERIAL_ID, 18, '0') = r.MATNR
  AND md.LANGUAGE_ID = 'E'

WHERE r.WERKS  = 'C061'
  AND r.BWART  = '261'
  AND r.XLOEK != 'X'
  AND r.BDMNG  > COALESCE(r.ENMNG, 0)
