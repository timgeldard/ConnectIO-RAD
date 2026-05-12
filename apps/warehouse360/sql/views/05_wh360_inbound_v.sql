-- =============================================================================
-- View : ${TRACE_CATALOG}.wh360.wh360_inbound_v
-- Phase: 1 -- direct join on raw SAP tables (cross-plant source for PO)
-- Sources: ${PUBLISHED_CATALOG}.central_services.procurementorderobject_ekko (EKKO)
--          ${PUBLISHED_CATALOG}.central_services.procurementorderobject_ekpo (EKPO)
--          ${TRACE_CATALOG}.sap.inspection_qals (QALS)
-- Filter : EKPO.WERKS is populated and EKPO.ELIKZ != 'X'
-- Purpose: Open inbound PO lines with GR progress and QA inspection status
-- =============================================================================

CREATE OR REPLACE VIEW ${TRACE_CATALOG}.wh360.wh360_inbound_v AS

WITH qa_latest AS (
  SELECT
    MATNR,
    WERK,
    EBELN,
    EBELP,
    PRUEFLOS,
    INSMK,
    ENSTEHDAT,
    ROW_NUMBER() OVER (
      PARTITION BY EBELN, EBELP
      ORDER BY ENSTEHDAT DESC, PRUEFLOS DESC
    )                                                            AS rn
  FROM ${TRACE_CATALOG}.sap.inspection_qals
  WHERE EBELN IS NOT NULL
    AND LENGTH(TRIM(EBELN)) > 0
)

SELECT
  ek.EBELN                                                       AS po_id,
  ep.EBELP                                                       AS po_item,
  ek.BSART                                                       AS doc_type,
  ek.BSTYP                                                       AS doc_cat,
  ek.LIFNR                                                       AS vendor_id,
  vn.NAME1                                                       AS vendor_name,
  ep.WERKS                                                       AS plant_id,
  ep.LGORT                                                       AS storage_loc,
  ep.MATNR                                                       AS material_id,
  md.MATERIAL_NAME                                               AS material_name,
  ep.MENGE                                                       AS ordered_qty,
  CAST(0 AS DECIMAL(13,3))                                         AS gr_qty,
  ep.MEINS                                                       AS uom,
  ep.AGDAT                                                          AS delivery_date,
  ek.BEDAT                                                       AS po_date,
  ep.ELIKZ                                                       AS delivery_complete,
  ep.MENGE                                                          AS open_qty,

  qa.PRUEFLOS                                                    AS qa_lot_id,

  -- qa_status: no lot / in QA inspection stock (INSMK=Q) / released
  CASE
    WHEN qa.PRUEFLOS IS NULL THEN 'no_lot'
    WHEN qa.INSMK = 'Q'     THEN 'inspection'
    ELSE 'released'
  END                                                            AS qa_status

FROM ${PUBLISHED_CATALOG}.central_services.procurementorderobject_ekko AS ek
JOIN ${PUBLISHED_CATALOG}.central_services.procurementorderobject_ekpo AS ep
  ON  ep.EBELN = ek.EBELN
LEFT JOIN qa_latest AS qa
  ON  qa.EBELN  = ep.EBELN
  AND qa.EBELP  = ep.EBELP
  AND qa.rn = 1

LEFT JOIN ${PUBLISHED_CATALOG}.central_services.vendormaster_lfa1 AS vn
  ON vn.LIFNR = ek.LIFNR
LEFT JOIN ${TRACE_CATALOG}.silver.silver_material_description AS md
  ON LPAD(md.MATERIAL_ID, 18, '0') = ep.MATNR
  AND md.LANGUAGE_ID = 'E'

WHERE ep.WERKS IS NOT NULL
  AND LENGTH(TRIM(ep.WERKS)) > 0
  AND ep.ELIKZ != 'X'
