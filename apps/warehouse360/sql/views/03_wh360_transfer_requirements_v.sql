-- =============================================================================
-- View : connected_plant_uat.wh360.wh360_transfer_requirements_v
-- Phase: 1 -- direct query on raw SAP table
-- Sources: sap.transferrequirementobjects_ltbk (LTBK)
-- Filter : LGNUM IS NOT NULL AND LENGTH(TRIM(LGNUM)) > 0
-- Purpose: WM transfer requirements with age and priority; all statuses included
-- =============================================================================

CREATE OR REPLACE VIEW connected_plant_uat.wh360.wh360_transfer_requirements_v AS

SELECT
  TBNUM                                                          AS tr_id,
  LGNUM                                                          AS lgnum,
  STATU                                                          AS status,
  TRART                                                          AS tr_type,
  BETYP                                                          AS ref_type,
  BENUM                                                          AS ref_doc,
  RSNUM                                                          AS reservation_no,
  BDATU                                                          AS created_date,
  BWART                                                          AS movement_type,
  ANZPS                                                          AS item_count,
  BRGEW                                                          AS gross_weight,
  GEWEI                                                          AS weight_uom,
  TBPRI                                                          AS priority,

  -- age_mins: minutes since TR creation date (date-level precision from BDATU)
  CASE
    WHEN BDATU IS NOT NULL
     AND LENGTH(TRIM(BDATU)) = 10
     AND BDATU <> '0001-01-01'
    THEN (unix_timestamp() - unix_timestamp(to_date(BDATU))) / 60.0
    ELSE NULL
  END                                                            AS age_mins

FROM connected_plant_uat.sap.transferrequirementobjects_ltbk

WHERE LGNUM IS NOT NULL
  AND LENGTH(TRIM(LGNUM)) > 0
