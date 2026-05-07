# SAP Bronze Catalog — Confirmed Table & Column Reference

Derived from `connected_plant_uat.information_schema` queries run 2026-05-05.
All table names follow the pattern `<business_object>_<SAP_TABLE_CODE>`.

The warehouse360 SAP sources YAML (`warehouse360_sap_sources.yaml`) is the
authoritative list of tables and their status. This file adds the confirmed
column details for tables relevant to IMWM views.

---

## connected_plant_uat.sap — Plant-Level SAP Extractions

### storagelocationmaterial_mard (MARD — IM Book Stock)

| Column | Type | Notes |
|---|---|---|
| MATNR | STRING | Material number |
| WERKS | STRING | Plant |
| LGORT | STRING | Storage location |
| LABST | DECIMAL | Unrestricted-use stock |
| INSME | DECIMAL | QI (quality inspection) stock |
| SPEME | DECIMAL | Blocked stock |
| EINME | DECIMAL | Restricted-use stock |
| UMLME | DECIMAL | In-transfer / transfer-posting stock (**not TRAME**) |
| RETME | DECIMAL | Returns/consignment stock |
| LVORM | STRING | Deletion flag |
| LFGJA | STRING | Fiscal year of last movement |
| LFMON | STRING | Posting period of last movement |
| SPERR | STRING | Physical inventory block indicator |

### materialmaster_mara (MARA — Material Master)

**No pricing columns.** Pricing is in MBEW.

| Column | Type | Notes |
|---|---|---|
| MATNR | STRING | Material number |
| MTART | STRING | Material type (FERT, ROH, HALB, VERP) |
| MEINS | STRING | Base unit of measure |
| MSTAE | STRING | Cross-plant material status |
| MSTAV | STRING | Cross-plant material status valid-from |

### materialvaluation_mbew (MBEW — Material Valuation / Pricing)

Join: `MARD.MATNR = MBEW.MATNR AND MARD.WERKS = MBEW.BWKEY AND MBEW.BWTAR = ''`

| Column | Type | Notes |
|---|---|---|
| MATNR | STRING | Material number |
| BWKEY | STRING | Valuation area (= plant in standard config) |
| BWTAR | STRING | Valuation type; use `''` for standard (non-split) |
| VPRSV | STRING | Price control: `S`=standard price, `V`=moving average |
| STPRS | DECIMAL | Standard price |
| VERPR | DECIMAL | Moving average price |
| PEINH | DECIMAL | Price unit (usually 1; divide STPRS/VERPR by this) |
| LBKUM | DECIMAL | Total valuated stock |
| SALK3 | DECIMAL | Total value at standard price |

### storagelocation_t001l (T001L — Storage Location Text)

Prefer `connected_plant_{env}.gold.gold_storage` which has the same data with cleaner column names.

| Column | Type | Notes |
|---|---|---|
| WERKS | STRING | Plant |
| LGORT | STRING | Storage location |
| LGOBE | STRING | Storage location description |

### quant_lqua (LQUA — WM Quants)

| Column | Type | Notes |
|---|---|---|
| LGNUM | STRING | Warehouse number |
| LGTYP | STRING | Storage type |
| LGPLA | STRING | Storage bin |
| MATNR | STRING | Material number |
| WERKS | STRING | Plant (confirmed present in this extraction) |
| CHARG | STRING | Batch number |
| GESME | DECIMAL | Total quant quantity (**not MENGE**) |
| MEINS | STRING | Unit of measure |
| BESTQ | STRING | Stock category indicator (**not BESTTYP**) |
| BDATU | STRING | GR/posting date (format yyyy-MM-dd; guard against '0001-01-01') |
| VFDAT | STRING | Shelf-life expiry date (same format) |
| TRAME | DECIMAL | Stock in WM transfer (different meaning from MARD.UMLME) |
| No LVORM | — | LQUA has no deletion flag; filter `WERKS IS NOT NULL` |

Interim/handover storage types: `LGTYP IN ('0921','0922','0930')`.

### storagebin_lagp (LAGP — Storage Bins)

| Column | Type | Notes |
|---|---|---|
| LGNUM | STRING | Warehouse number |
| LGTYP | STRING | Storage type |
| LGPLA | STRING | Storage bin |
| LGBER | STRING | Storage section |
| LPTYP | STRING | Bin type |
| KZLER | STRING | Empty indicator (`X`=empty) |
| ANZQU | DECIMAL | Current number of quants |
| MAXQU | DECIMAL | Maximum number of quants |
| SKZUA | STRING | Block for goods receipts |
| SKZUE | STRING | Block for goods issues |
| SPGRU | STRING | Block reason |

### transferorderobjects_ltak (LTAK — Transfer Order Header)

| Column | Type | Notes |
|---|---|---|
| LGNUM | STRING | Warehouse number |
| TANUM | STRING | Transfer order number |
| BDATU | STRING | Created date (**no ERDAT column**) |
| KQUIT | STRING | Confirmation flag: `''`/NULL=open, `X`=fully confirmed |
| BWART | STRING | Movement type |
| BETYP | STRING | Reference document category |
| BENUM | STRING | Reference document number |
| VBELN | STRING | Delivery document |

**Open TO filter:** `KQUIT = '' OR KQUIT IS NULL`

### transferorderobjects_ltap (LTAP — Transfer Order Items)

| Column | Type | Notes |
|---|---|---|
| LGNUM | STRING | Warehouse number |
| TANUM | STRING | Transfer order number |
| TAPOS | STRING | Transfer order item |
| MATNR | STRING | Material number |
| WERKS | STRING | Plant |
| CHARG | STRING | Batch |
| NSOLM | DECIMAL | Planned transfer quantity (**not ANFME**) |
| NISTM | DECIMAL | Actual confirmed quantity |
| MAKTX | STRING | Material description (denormalized) |
| NLTYP | STRING | Destination storage type |
| NLPLA | STRING | Destination storage bin |
| VLTYP | STRING | Source storage type |
| VLPLA | STRING | Source storage bin |
| PQUIT | STRING | Item confirmation flag |
| VFDAT | STRING | Expiry date |

### inventorymovement_mseg (MSEG — Material Document Items)

MKPF (material document header) fields are **denormalized** into this table — no JOIN needed.

| Column | Type | Notes |
|---|---|---|
| MBLNR | STRING | Material document number |
| ZEILE | STRING | Document item |
| BWART | STRING | Movement type |
| MATNR | STRING | Material number |
| WERKS | STRING | Plant |
| LGORT | STRING | Storage location |
| CHARG | STRING | Batch |
| MENGE | DECIMAL | Signed movement quantity |
| MEINS | STRING | Unit of measure |
| BUDAT_MKPF | STRING | Posting date (from MKPF) |
| CPUDT_MKPF | STRING | Created date (from MKPF) |
| CPUTM_MKPF | STRING | Posting time (from MKPF) |
| USNAM_MKPF | STRING | Username (from MKPF) |
| AUFNR | STRING | Process order number |
| VBELN_IM | STRING | Related delivery |

### batchstock_mchb (MCHB — Batch Stock)

| Column | Type | Notes |
|---|---|---|
| MATNR | STRING | Material number |
| WERKS | STRING | Plant |
| LGORT | STRING | Storage location |
| CHARG | STRING | Batch number |
| CLABS | DECIMAL | Unrestricted batch stock |
| CUMLM | DECIMAL | Batch in-transfer stock |
| CINSM | DECIMAL | QI batch stock |
| CEINM | DECIMAL | Restricted batch stock |
| CSPEM | DECIMAL | Blocked batch stock |
| LVORM | STRING | Deletion flag |
| LFGJA | STRING | Fiscal year of last movement |
| LFMON | STRING | Posting period of last movement |
| ERSDA | STRING | Creation date (proxy for batch receive date) |

**Note:** MCHB has stock quantities but not expiry dates (VFDAT) or GR dates (HERDAT).
For expiry and GR dates use MCHA from `published_uat.central_services.batches_mcha`.

---

## published_uat.central_services — Cross-Plant SAP Extractions

### batches_mcha (MCHA — Batch Master)

| Column | Type | Notes |
|---|---|---|
| MATNR | STRING | Material number |
| WERKS | STRING | Plant |
| CHARG | STRING | Batch number |
| VFDAT | STRING | Shelf-life expiry date |
| HSDAT | STRING | Manufacture date (Herstelldatum) — use for inventory aging |
| ERSDA | STRING | Batch record creation date |
| LVORM | STRING | Deletion flag |

**No HERDAT column in this extraction.** Use `HSDAT` for the manufacture/GR date.

### warehouseforplant_t320 (T320 — Warehouse to Plant Mapping)

| Column | Type | Notes |
|---|---|---|
| WERKS | STRING | Plant |
| LGORT | STRING | Storage location |
| LGNUM | STRING | Warehouse number |

Maps LQUA.LGNUM → WERKS when plant is not denormalized into LQUA (not needed for current extraction where LQUA.WERKS is present).

---

## connected_plant_uat.silver — Silver Layer

### silver_material_description

| Column | Type | Notes |
|---|---|---|
| MATERIAL_ID | STRING | Material number (may need LPAD to 18 chars for join) |
| LANGUAGE_ID | STRING | Language key; use `'E'` for English |
| MATERIAL_NAME | STRING | Material short text |
| MATERIAL_NAME_UPPERCASE | STRING | Uppercase version for matchcode search |

### silver_material_description (already in ai-context)

| Column | Type | Notes |
|---|---|---|
| MATERIAL_ID | STRING | Material number (may need LPAD to 18 chars for join to MATNR) |
| LANGUAGE_ID | STRING | Language key; use `'E'` for English |
| MATERIAL_NAME | STRING | Material short text |
| MATERIAL_NAME_UPPERCASE | STRING | Uppercase version for matchcode search |

### silver_inventory_movement

Clean version of MSEG. Key differences from bronze:
- `POSTING_DATE` is already a `DATE` type (not STRING)
- `USER_NAME` instead of `USNAM_MKPF`
- `MOVEMENT_TYPE_GROUP` and `MOVEMENT_TYPE_DESCRIPTION` added
- `MATERIAL_ID`, `PLANT_ID`, `STORAGE_ID` instead of SAP codes

### silver_stock

Clean version of MCHB. Key differences:
- `UNRESTRICTED`, `TRANSIT`, `QUALITY_INSPECTION`, `RESTRICTED`, `BLOCKED` instead of SAP codes
- `MATERIAL_ID`, `PLANT_ID`, `STORAGE_ID` naming
- Has `LVORM` deletion flag

### silver_storage

Replaces T001L with clean naming:
- `PLANT_ID`, `STORAGE_ID`, `STORAGE_NAME`

### silver_plant

Plant master with clean naming:
- `PLANT_ID`, `PLANT_NAME`, `VALUATION_AREA` (= MBEW.BWKEY)

---

## connected_plant_uat.gold — Gold Layer

### gold_storage

| Column | Type | Notes |
|---|---|---|
| PLANT_ID | STRING | Plant |
| STORAGE_ID | STRING | Storage location (= MARD.LGORT) |
| STORAGE_NAME | STRING | Storage location description (= T001L.LGOBE) |

**Preferred over T001L for new views.**

### gold_plant

| Column | Type | Notes |
|---|---|---|
| PLANT_ID | STRING | Plant (= MARD.WERKS) |
| PLANT_NAME | STRING | Plant name |
| VALUATION_AREA | STRING | = MBEW.BWKEY; use for MBEW join |

### gold_inventory_movement

Clean movements fact with:
- `POSTING_DATE` as `DATE`
- `USER_NAME`, `MOVEMENT_TYPE`, `MOVEMENT_TYPE_GROUP`, `MOVEMENT_TYPE_DESCRIPTION`
- `MATERIAL_ID`, `PLANT_ID`, `STORAGE_ID`, `BATCH_ID`
- `QUANTITY` (unsigned), `SIGNED_QTY` (signed)

**Preferred over raw MSEG for the imwm_movements_v view.**

### gold_stock

Batch-level stock snapshot (from MCHB):
- `MATERIAL_ID`, `BATCH_ID`, `PLANT_ID`, `STORAGE_ID`
- `UNRESTRICTED`, `TRANSIT`, `QUALITY_INSPECTION`, `RESTRICTED`, `BLOCKED`
- `TOTAL_STOCK`

Note: `gold_stock` is batch-level (MCHB), not sloc-level (MARD). For IM book stock
totals by storage location, use MARD directly.
