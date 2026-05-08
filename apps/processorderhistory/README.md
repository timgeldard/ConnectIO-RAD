# processorderhistory — Process Order History

Databricks App: FastAPI backend + Vite/React/TypeScript frontend providing a
plant-floor view of process order execution. Six domains cover order execution,
manufacturing analytics (OEE, downtime, equipment, quality, yield, adherence),
production planning, Genie Assist, and user preferences.

## 📚 Documentation

- [**Architecture Overview**](./docs/architecture.md): domain breakdown, bounded contexts, and data flow.
- [**Local Setup Guide**](./docs/setup.md): prerequisites and how to run locally.
- [**API Reference**](./docs/api.md): backend endpoints and request models.

## Layout

```
backend/
  main.py                             FastAPI entry, readiness + SPA serving
  order_execution/                    order list, detail, day view, pours
  manufacturing_analytics/            OEE, downtime, equipment insights, quality, yield, adherence
  production_planning/                planning board, vessel planning
  genie_assist/                       Genie natural-language query integration
  prefs_store.py                      per-user preferences (plant, timezone)
frontend/
  src/App.tsx                         layout, sidebar, navigation
  src/pages/                          one directory per domain
  src/data/mock.ts                    reference data for demo mode
scripts/
  build.py                            pre-bundle: copy shared libs + npm run build
docs/                                 architecture.md, setup.md, api.md
```

## Data contract

SQL queries use two schemas, both resolved from `POH_CATALOG` (env var, default `connected_plant_uat`).

### `csm_process_order_history` schema (`POH_SCHEMA` env var)

```
vw_gold_process_order               process order headers — status, material, plant, dates
vw_gold_material                    material master — description, base UoM
vw_gold_process_order_material      BOM components per order (input materials)
vw_gold_process_order_phase         order phases and operations
vw_gold_process_order_plan          planned orders from MRP
vw_gold_adp_movement                goods movements / pours with batch and quantity
vw_gold_confirmation                order confirmations — actual quantities and labour
vw_gold_downtime_and_issues         downtime events with cause classification
vw_gold_inspection_lot              inspection lot headers linked to orders
vw_gold_inspection_result           MIC-level inspection results
vw_gold_inspection_specification    inspection specifications and tolerance limits
vw_gold_inspection_usage_decision   usage decision per inspection lot (PASS/FAIL/etc.)
vw_gold_logs_notes_and_comments     production notes and comments
vw_gold_equipment_history           equipment state-change events (cleaning, in-use, etc.)
vw_gold_batch_material              batch-level material relationships
metric_oee_daily                    pre-computed daily OEE metrics
metric_schedule_adherence           pre-computed schedule adherence metrics
silver_process_order                LEFT JOIN only — scheduled start dates; degrades gracefully
                                    if `POH_CATALOG.silver` is inaccessible
```

### `csm_equipment_history` schema (accessed via `instrument_tbl()`)

```
vw_gold_instrument                  equipment/instrument master — type, sub-type, plant
```

## Dev

```
make install
make dev
```

Starts uvicorn on `:8003` and Vite on `:5173`. Vite proxies `/api` to uvicorn.

## Deploy

```
make deploy                   # defaults to --profile uat
make deploy PROFILE=prod
```

The script copies `libs/shared-db` and `libs/shared-api` into the app root,
builds the frontend, renders `app.yaml` from `app.template.yaml`, runs
`databricks bundle deploy`, then snapshots a fresh deployment.
