-- =============================================================================
-- View : connected_plant_uat.wh360.imwm_movements_v
-- Sources: sap.inventorymovement_mseg (MSEG — MKPF fields denormalized)
--          silver.silver_material_description
-- Grain : (MBLNR, ZEILE) — one row per material document line
-- Purpose: Recent goods movements for the Overview activity strip
-- Notes : MKPF fields (posting date/time/user) are denormalized into MSEG
--         as BUDAT_MKPF, CPUTM_MKPF, USNAM_MKPF — no JOIN to MKPF needed.
--         LIMIT is applied in the DAL (not here) for caller-controlled page size.
--         WM-internal movements filtered by BWLVS column if present in extraction.
-- =============================================================================

CREATE OR REPLACE VIEW connected_plant_uat.wh360.imwm_movements_v AS

SELECT
  ms.BUDAT_MKPF                                                    AS posting_date,
  ms.CPUTM_MKPF                                                    AS posting_time,
  ms.BWART                                                         AS movement_type,
  ms.MATNR                                                         AS material_id,
  COALESCE(md.MATERIAL_NAME, ms.MATNR)                            AS material_name,
  ms.WERKS                                                         AS plant_id,
  ms.LGORT                                                         AS storage_loc,
  ms.MENGE                                                         AS quantity,
  ms.MEINS                                                         AS uom,
  ms.USNAM_MKPF                                                    AS username,
  ms.MBLNR                                                         AS document_number,
  ms.CHARG                                                         AS batch_id

FROM connected_plant_uat.sap.inventorymovement_mseg AS ms

LEFT JOIN connected_plant_uat.silver.silver_material_description AS md
  ON  LPAD(md.MATERIAL_ID, 18, '0') = ms.MATNR
  AND md.LANGUAGE_ID = 'E'

WHERE ms.BUDAT_MKPF >= date_format(date_add(current_date(), -1), 'yyyy-MM-dd')
  AND ms.WERKS IS NOT NULL
  AND LENGTH(TRIM(ms.WERKS)) > 0
  AND ms.MATNR IS NOT NULL
  AND LENGTH(TRIM(ms.MATNR)) > 0

ORDER BY ms.BUDAT_MKPF DESC, ms.CPUTM_MKPF DESC
