-- =============================================================================
-- View : connected_plant_uat.wh360.wh360_transfer_orders_v
-- Phase: 1 -- direct join on raw SAP tables
-- Sources: sap.transferorderobjects_ltak (LTAK)
--          sap.transferorderobjects_ltap (LTAP)
-- Filter : LTAP.WERKS = 'C061'
-- Purpose: WM transfer order header + item detail with age and confirmation status
-- =============================================================================

CREATE OR REPLACE VIEW connected_plant_uat.wh360.wh360_transfer_orders_v AS

SELECT
  lk.TANUM                                                       AS to_id,
  lk.LGNUM                                                       AS lgnum,
  lk.BETYP                                                       AS ref_type,
  lk.BENUM                                                       AS ref_doc,
  lk.VBELN                                                       AS delivery_id,
  lk.RSNUM                                                       AS reservation_no,
  lk.BDATU                                                       AS created_date,
  lk.BWART                                                       AS movement_type,
  lk.KQUIT                                                       AS confirmed,

  -- age_mins: minutes since TO creation date (date-level precision from BDATU)
  CASE
    WHEN lk.BDATU IS NOT NULL
     AND LENGTH(TRIM(lk.BDATU)) = 10
     AND lk.BDATU <> '0001-01-01'
    THEN (unix_timestamp() - unix_timestamp(to_date(lk.BDATU))) / 60.0
    ELSE NULL
  END                                                            AS age_mins,

  lt.TAPOS                                                       AS item_no,
  lt.MATNR                                                       AS material_id,
  lt.MAKTX                                                       AS material_name,
  lt.WERKS                                                       AS plant_id,
  lt.CHARG                                                       AS batch_id,
  lt.MEINS                                                       AS uom,
  CONCAT(lt.VLTYP, '-', lt.VLPLA)                               AS src_bin,
  CONCAT(lt.NLTYP, '-', lt.NLPLA)                               AS dst_bin,
  lt.NSOLM                                                       AS qty_planned,
  lt.NISTM                                                       AS qty_actual,
  lt.PQUIT                                                       AS item_confirmed,
  lt.VFDAT                                                       AS expiry_date

FROM connected_plant_uat.sap.transferorderobjects_ltak AS lk
JOIN connected_plant_uat.sap.transferorderobjects_ltap AS lt
  ON  lt.LGNUM = lk.LGNUM
  AND lt.TANUM = lk.TANUM

WHERE lt.WERKS = 'C061'
