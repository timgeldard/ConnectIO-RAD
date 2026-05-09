-- =============================================================================
-- View : ${TRACE_CATALOG}.wh360.imwm_movements_v
-- Sources: sap.inventorymovement_mseg (MSEG — MKPF fields denormalized)
--          silver.silver_material_description
-- Grain : (MBLNR, ZEILE) — one row per material document line
-- Purpose: Recent IM goods movements for the Movements tab
-- Notes : MKPF fields (posting date/time/user) are denormalized into MSEG
--         as BUDAT_MKPF, CPUTM_MKPF, USNAM_MKPF — no JOIN to MKPF needed.
--         MENGE is signed in the bronze extract (+ve = receipt, -ve = issue).
--         LIMIT is applied in the DAL (not here) for caller-controlled page size.
-- Note  : earlier drafts proposed filtering WM-internal movements by BWLVS,
--         but BWLVS is not extracted into the MSEG bronze table today, so the
--         filter cannot be applied. The earlier comment claiming a filter is
--         removed to keep the doc honest. Restore the predicate here if BWLVS
--         is added to the extraction in future.
-- =============================================================================

CREATE OR REPLACE VIEW ${TRACE_CATALOG}.wh360.imwm_movements_v AS

SELECT
  ms.BUDAT_MKPF                                                    AS posting_date,
  ms.CPUTM_MKPF                                                    AS posting_time,
  ms.BWART                                                         AS movement_type,
  CASE ms.BWART
    WHEN '101' THEN 'Production'   WHEN '102' THEN 'Production'
    WHEN '201' THEN 'Consumption'  WHEN '202' THEN 'Consumption'
    WHEN '261' THEN 'Consumption'  WHEN '262' THEN 'Consumption'
    WHEN '301' THEN 'Transfer'     WHEN '302' THEN 'Transfer'
    WHEN '311' THEN 'Transfer'     WHEN '312' THEN 'Transfer'
    WHEN '321' THEN 'Transfer'     WHEN '322' THEN 'Transfer'
    WHEN '531' THEN 'Adjustment'   WHEN '532' THEN 'Adjustment'
    WHEN '601' THEN 'Shipment'     WHEN '602' THEN 'Shipment'
    WHEN '641' THEN 'STO Transfer' WHEN '642' THEN 'STO Transfer'
    WHEN '701' THEN 'Adjustment'   WHEN '702' THEN 'Adjustment'
    WHEN '711' THEN 'Adjustment'   WHEN '712' THEN 'Adjustment'
    ELSE 'Other'
  END                                                              AS stock_status,
  ms.MATNR                                                         AS material_id,
  COALESCE(md.MATERIAL_NAME, ms.MATNR)                            AS material_name,
  ms.WERKS                                                         AS plant_id,
  ms.LGORT                                                         AS storage_loc,
  ms.MENGE                                                         AS quantity,
  ms.MEINS                                                         AS uom,
  ms.USNAM_MKPF                                                    AS username,
  ms.MBLNR                                                         AS document_number,
  ms.CHARG                                                         AS batch_id

FROM ${TRACE_CATALOG}.sap.inventorymovement_mseg AS ms

LEFT JOIN ${TRACE_CATALOG}.silver.silver_material_description AS md
  ON  LPAD(md.MATERIAL_ID, 18, '0') = ms.MATNR
  AND md.LANGUAGE_ID = 'E'

-- BUDAT_MKPF is a string column in bronze; cast both sides so the comparison
-- is a real date comparison, not a lexicographic string compare that would
-- silently break if the source format ever drifts.
WHERE TRY_CAST(ms.BUDAT_MKPF AS DATE) >= date_add(current_date(), -1)
  AND ms.WERKS IS NOT NULL
  AND LENGTH(TRIM(ms.WERKS)) > 0
  AND ms.MATNR IS NOT NULL
  AND LENGTH(TRIM(ms.MATNR)) > 0

ORDER BY ms.BUDAT_MKPF DESC, ms.CPUTM_MKPF DESC
