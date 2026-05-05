# IMWM — Live Data Integration Plan

## Context

The IMWM (Inventory Management / Warehouse Management cockpit) app at `apps/platform/standalone/imwm/` is fully built as a React UI but runs entirely on mock data (`data.jsx`). The goal is to wire it to real Databricks tables in the `connected_plant` catalog, adding SQL views, a backend DAL, FastAPI routes, and a frontend API layer to replace mock data.

The app has six views:
- **Overview** — plant KPI cards, recent movements strip
- **IM Explorer** — material-level stock split by 5 stock types (unrestricted / QI / blocked / restricted / interim)
- **WM Explorer** — storage-type utilisation + bin-level detail
- **Reconciliation** — IM vs WM delta lines, classified by root cause
- **Exceptions** — rule-generated alert queue with severity/SLA
- **Analytics** — inventory aging buckets, ABC/XYZ heatmap, 30-day trend

---

## Tables to Use

All tables are in `connected_plant_{env}` catalog only.

### SAP Bronze — `connected_plant_{env}.sap.*`

| Table | Purpose | Key Fields |
|---|---|---|
| `MARD` | IM book stock by plant/sloc | `MATNR`, `WERKS`, `LGORT`, `LABST` (unrestricted), `INSME` (QI), `SPEME` (blocked), `EINME` (restricted), `TRAME` (transit), `LFGJA`/`LFMON` (last movement period) |
| `MARA` | Material master | `MATNR`, `MTART`, `MEINS`, `STPRS` (standard price), `VPRSV` (price control) |
| `LQUA` | WM quants (physical stock) | `LGNUM`, `LGTYP`, `LGPLA`, `MATNR`, `WERKS`, `CHARG`, `MENGE`, `MEINS`, `BESTTYP` (stock status), `LVORM` (delete flag), `VFDAT` (expiry), `WDATU` (GR date) |
| `LAGP` | WM storage bins | `LGNUM`, `LGTYP`, `LGPLA`, `MAXANZ` (max quants), `ANZQU` (current quants), `SPERR` (block indicator), `LGBER` (section) |
| `LTAK` | Transfer order header | `LGNUM`, `TANUM`, `ERDAT` (created date), `BDATU` (created time), `STAT` (status: A=created, B=partially confirmed, C=fully confirmed) |
| `LTAP` | Transfer order items | `LGNUM`, `TANUM`, `TAPOS`, `MATNR`, `WERKS`, `NLTYP`/`NLPLA` (dst), `VLTYP`/`VLPLA` (src), `ANFME` (planned qty) |
| `MCHA` | Batch master | `MATNR`, `WERKS`, `CHARG`, `VFDAT` (expiry), `HERDAT` (creation/GR date), `LVORM` (delete flag) |
| `MSEG` | Material movement lines | `MBLNR`, `ZEILE`, `BUDAT`, `BWART` (movement type), `MATNR`, `WERKS`, `LGORT`, `MENGE`, `MEINS`, `USNAM`, `CHARG` |
| `MKPF` | Material document header | `MBLNR`, `BUDAT`, `CPUTM` (posting time) |
| `T001L` | Storage location text | `WERKS`, `LGORT`, `LGOBE` (description) |

### Silver — `connected_plant_{env}.silver.*`

| Table | Purpose |
|---|---|
| `silver_material_description` | Material descriptions — already used by existing wh360 views; join on `MATERIAL_ID` LPAD to 18 chars, `LANGUAGE_ID = 'E'` |

### Gold — `connected_plant_{env}.gold.*`

| Table | Purpose |
|---|---|
| `gold_plant` | Plant names and regions — join on `PLANT_ID` |

### Existing wh360 Views to Reuse (no changes needed)

| View | Reused by | Notes |
|---|---|---|
| `wh360_bin_stock_v` | WM Explorer — bin-level tab | Already covers LAGP + LQUA + material description |
| `wh360_transfer_orders_v` | Reconciliation — timing detection | Open TOs (STAT in A, B) classify delta as "timing" vs "true" |
| `wh360_kpi_snapshot_v` | Overview — bins_blocked / bin_util_pct | Partial reuse |

---

## New SQL Views

All new views go in `apps/warehouse360/sql/views/` and deploy to the `wh360` schema. Deploy in order — view 13 references view 11.

### View 11 — `imwm_stock_comparison_v` (11_imwm_stock_comparison_v.sql)

**Grain:** (MATNR, WERKS, LGORT)
**Purpose:** Core IM vs WM comparison — powers IM Explorer, Reconciliation, and Overview KPIs

**CTEs:**
1. `im_stock` — MARD joined to MARA (std price / price control), T001L (sloc name), gold_plant (plant name)
2. `wm_stock` — LQUA aggregated by (MATNR, WERKS): SUM(MENGE) where LVORM = '' and LGTYP NOT IN ('0921','0922','0930','0910')
3. `interim_stock` — LQUA where LGTYP IN ('0921','0922','0930'): IM/WM handover bins
4. `batch_counts` — COUNT(DISTINCT CHARG) from MCHA where LVORM = '', grouped by (MATNR, WERKS)
5. `open_tos` — COUNT of open LTAK (STAT IN 'A','B') joined to LTAP, grouped by (MATNR, WERKS)

**Computed columns:**
- `im_total_qty` = LABST + INSME + SPEME + EINME + TRAME
- `wm_total_qty` = wm_stock.total + interim_stock.total
- `delta_qty` = wm_total_qty - im_total_qty
- `inventory_value_eur` = STPRS * im_total_qty (where VPRSV = 'S'; else VERPR * im_total_qty)
- `mismatch_kind`:
  - `'match'` — ABS(delta) <= im_total * 0.01 OR im_total = 0
  - `'timing'` — open_tos > 0 OR interim_qty > 0
  - `'true'` — remaining non-zero deltas
- `abc_class` — inline window function: rank by inventory_value_eur DESC within plant; cumulative pct <=0.80 → 'A', <=0.95 → 'B', else 'C'

**Output columns:** `material_id`, `material_name`, `material_type`, `uom`, `plant_id`, `plant_name`, `storage_loc`, `storage_loc_name`, `unrestricted_qty`, `qi_qty`, `blocked_qty`, `restricted_qty`, `interim_qty`, `im_total_qty`, `wm_total_qty`, `delta_qty`, `inventory_value_eur`, `batch_count`, `open_tos`, `mismatch_kind`, `abc_class`

---

### View 12 — `imwm_movements_v` (12_imwm_movements_v.sql)

**Grain:** (MBLNR, ZEILE)
**Purpose:** Recent goods movements for the Overview activity strip

**Logic:** MSEG JOIN MKPF on MBLNR; filter BUDAT >= CURRENT_DATE - 1; JOIN silver_material_description; exclude WM-internal movement types; ORDER BY BUDAT DESC, CPUTM DESC (LIMIT applied in DAL, not view)

**Output columns:** `posting_date`, `posting_time`, `movement_type`, `material_id`, `material_name`, `plant_id`, `storage_loc`, `quantity`, `uom`, `username`, `document_number`, `batch_id`

---

### View 13 — `imwm_exceptions_v` (13_imwm_exceptions_v.sql)

**Grain:** one row per exception instance
**Purpose:** Exception queue — powers Exceptions tab

**Logic:** UNION ALL of rule subqueries:

| Rule | Sev | SLA (h) | Source | Condition |
|---|---|---|---|---|
| Negative IM stock | 4 | 2 | MARD | LABST < 0 OR INSME < 0 |
| Negative WM quant | 4 | 2 | LQUA | MENGE < 0 AND LVORM = '' |
| Expired batch with stock | 3 | 8 | MCHA + MARD | VFDAT < CURRENT_DATE AND LABST > 0 |
| IM/WM true variance | 3 | 24 | imwm_stock_comparison_v | mismatch_kind = 'true' |
| Open TO aged > 24h | 2 | 0 | LTAK | STAT IN ('A','B') AND ERDAT < CURRENT_DATE - 1 |
| QI stock aged > 14d | 2 | 0 | MARD | INSME > 0 AND days since LFGJA/LFMON > 14 |
| Blocked stock aged > 3d | 1 | 0 | MARD | SPEME > 0 AND days since LFGJA/LFMON > 3 |

**Output columns:** `exception_type`, `severity`, `sla_hours`, `material_id`, `plant_id`, `storage_loc`, `detail_text`, `detected_date`

---

### View 14 — `imwm_analytics_aging_v` (14_imwm_analytics_aging_v.sql)

**Grain:** (plant_id, age_bucket)
**Purpose:** Aging distribution for Analytics tab

**Logic:** MCHA joined to MARD (LABST > 0); age_days = CURRENT_DATE - MCHA.HERDAT; bucketed into '0-30d' / '31-60d' / '61-90d' / '91-180d' / '>180d'; aggregate COUNT(DISTINCT MATNR), SUM(LABST * STPRS)

**Output columns:** `plant_id`, `age_bucket`, `age_bucket_order`, `material_count`, `total_value_eur`

---

## Backend Changes

### New DAL — `apps/warehouse360/backend/inventory_management/dal/imwm_stock.py`

```python
async def fetch_imwm_stock(token, plant_id=None) -> list[dict]
async def fetch_imwm_movements(token, plant_id=None) -> list[dict]   # LIMIT 200 applied here
async def fetch_imwm_exceptions(token, plant_id=None) -> list[dict]
async def fetch_imwm_aging(token, plant_id=None) -> list[dict]
```

All follow existing pattern: `tbl('view_name')`, `:plant_id` param via `sql_param()`, `run_sql_async()`.

### New Router — `apps/warehouse360/backend/inventory_management/router_imwm.py`

```
GET /imwm/stock            ?plant=   → fetch_imwm_stock
GET /imwm/movements        ?plant=   → fetch_imwm_movements
GET /imwm/exceptions       ?plant=   → fetch_imwm_exceptions
GET /imwm/analytics/aging  ?plant=   → fetch_imwm_aging
```

WM bins reuse existing `GET /inventory/bins` (already queries `wh360_bin_stock_v` — no changes).

### Platform Backend — `apps/platform/backend/main.py`

Add to `W360_ROUTERS`:
```python
(_optional_router("w360_backend.inventory_management.router_imwm", "w360_backend"), "/api/wh", ["IMWM"]),
```

---

## Frontend Changes — `apps/platform/standalone/imwm/`

### New: `api.jsx`

Thin async fetch wrapper; each function returns `{ data, error }`:
- `loadStock(plant)` → `/api/wh/imwm/stock?plant=<plant>`
- `loadMovements(plant)` → `/api/wh/imwm/movements?plant=<plant>`
- `loadExceptions(plant)` → `/api/wh/imwm/exceptions?plant=<plant>`
- `loadAging(plant)` → `/api/wh/imwm/analytics/aging?plant=<plant>`
- `loadBins(plant)` → `/api/wh/inventory/bins?plant=<plant>` (existing endpoint)

### Modified: `app.jsx`

Replace mock data imports with `useEffect` calls to `api.jsx` on mount and plant-filter change. Pass real arrays as props to view components. Feature-flag `window.USE_MOCK_DATA` for local dev fallback.

### Modified: view components

Each view receives data as props. Field names in API responses match view output columns exactly, so computed aggregations within each component require no changes.

---

## Critical File Map

### Create (new)
| File | Purpose |
|---|---|
| `apps/warehouse360/sql/views/11_imwm_stock_comparison_v.sql` | IM/WM stock comparison |
| `apps/warehouse360/sql/views/12_imwm_movements_v.sql` | Recent movements |
| `apps/warehouse360/sql/views/13_imwm_exceptions_v.sql` | Exception rules |
| `apps/warehouse360/sql/views/14_imwm_analytics_aging_v.sql` | Aging buckets |
| `apps/warehouse360/backend/inventory_management/dal/imwm_stock.py` | DAL functions |
| `apps/warehouse360/backend/inventory_management/router_imwm.py` | FastAPI router |
| `apps/platform/standalone/imwm/api.jsx` | Frontend fetch layer |

### Modify (existing)
| File | Change |
|---|---|
| `apps/platform/backend/main.py` | Register router_imwm in W360_ROUTERS |
| `apps/platform/standalone/imwm/app.jsx` | Wire API calls, pass props |
| `apps/platform/standalone/imwm/overview.jsx` | Accept props |
| `apps/platform/standalone/imwm/im.jsx` | Accept props |
| `apps/platform/standalone/imwm/wm.jsx` | Accept props |
| `apps/platform/standalone/imwm/recon.jsx` | Accept props |
| `apps/platform/standalone/imwm/exceptions.jsx` | Accept props |
| `apps/platform/standalone/imwm/analytics.jsx` | Accept props |

### Do not modify
- Any existing `wh360_*.sql` files — reused as-is
- Any existing w360_backend router/DAL files
- `data.jsx` — kept as dev fallback

---

## Verification

1. **SQL views:** Run each in Databricks SQL editor against `connected_plant_uat`; confirm non-zero rows, MATNR is zero-padded string
2. **API:** `GET /api/wh/imwm/stock?plant=1000` returns JSON array with correct field names and types
3. **Frontend:** Overview KPI cards show real totals; IM Explorer lists real materials; Exceptions tab shows rule-triggered alerts; Aging bars reflect real data
4. **Edge case:** Plant with no WM configured — `wm_total_qty = 0`, `mismatch_kind = 'true'` for all lines with stock

---

## Risks to Resolve Before Writing SQL

1. **MARD QI/blocked column names** — `INSME` vs `EISBE` for QI stock, `SPEME` vs `SPEIG` for blocked — verify against actual `sap.MARD` schema in Databricks before writing the view
2. **LQUA.WERKS availability** — MARD uses WERKS/LGORT; LQUA uses LGNUM. Confirm LQUA.WERKS exists in the extraction (added via T320 join by some extractors, absent in others) — if missing, join via LGNUM → plant mapping table
3. **ABC/XYZ source** — check if a native ABC field exists in `sap.MARA` before using the inline window-function computation
