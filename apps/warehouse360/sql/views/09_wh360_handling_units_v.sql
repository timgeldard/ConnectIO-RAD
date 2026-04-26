-- =============================================================================
-- View : connected_plant_uat.wh360.wh360_handling_units_v
-- Phase: 1 -- direct join on raw SAP tables (cross-plant source)
-- Sources: published_uat.central_services.handlingunit_vekp (VEKP)
--          published_uat.central_services.handlingunit_vepo (VEPO)
-- Filter : VEKP.WERKS = 'C061'
-- Purpose: Handling unit (pallet/carton) detail with packed content and delivery link
-- =============================================================================

CREATE OR REPLACE VIEW connected_plant_uat.wh360.wh360_handling_units_v AS

SELECT
  vk.VENUM                                                       AS hu_id,
  vk.EXIDV                                                       AS sscc,
  vk.WERKS                                                       AS plant_id,
  vk.LGORT                                                       AS storage_loc,
  vk.LGNUM                                                       AS lgnum,
  vk.VHART                                                       AS hu_type,
  vk.STATUS                                                      AS status,
  vk.BRGEW                                                       AS gross_weight,
  vk.NTGEW                                                       AS net_weight,
  vk.GEWEI                                                       AS weight_uom,
  vk.ERDAT                                                       AS created_date,

  -- delivery_id: populated only when HU is linked to an outbound delivery (VBTYP='J')
  CASE
    WHEN vp.VBTYP = 'J'
    THEN vp.VBELN
    ELSE NULL
  END                                                            AS delivery_id,

  vp.VBTYP                                                       AS ref_type,
  vp.MATNR                                                       AS material_id,
  vp.CHARG                                                       AS batch_id,
  vp.VEMNG                                                       AS packed_qty,
  vp.VEMEH                                                       AS uom,
  vp.VFDAT                                                       AS expiry_date,
  vp.WDATU                                                       AS gr_date,
  md.MATERIAL_NAME                                               AS material_name

FROM published_uat.central_services.handlingunit_vekp AS vk
LEFT JOIN published_uat.central_services.handlingunit_vepo AS vp
  ON  vp.VENUM = vk.VENUM

LEFT JOIN connected_plant_uat.silver.silver_material_description AS md
  ON LPAD(md.MATERIAL_ID, 18, '0') = vp.MATNR
  AND md.LANGUAGE_ID = 'E'

WHERE vk.WERKS = 'C061'
