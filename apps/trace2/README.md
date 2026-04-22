# trace2 — Batch Traceability

Databricks App: FastAPI backend + Vite/React frontend for batch-level
traceability across Unity Catalog gold views. Nine pages covering recall
readiness, bottom-up / top-down lineage, mass balance, quality, production
history, batch comparison, supplier risk, and certificate of analysis.

## Layout

```
backend/
  main.py                    FastAPI entry, readiness + SPA serving
  routers/trace.py           9 POST endpoints, rate-limited, freshness-tagged
  dal/trace_dal.py           all SQL queries against gold_* views
  schemas/trace_schemas.py   pydantic request models
  utils/db.py                token passthrough, parameterised run_sql_async
  utils/rate_limit.py        slowapi config
frontend/
  src/App.tsx                layout, sidebar, batch picker, theme tweaks
  src/pages/                 one file per page
  src/data/api.ts            typed API client + raw→typed mappers
  src/data/useBatchData.ts   generic loading/error hook
  src/components/
    LineageGraph.tsx         SVG lineage, dynamic depth, pan/zoom
    LoadFrame.tsx            shared loading/error/empty frames
  src/ui.tsx                 StatusPill, KPI, Card, BarChart, Donut, DataTable
scripts/
  deploy.sh                  one-command deploy (replaces `make deploy`)
  render-app-yaml.sh         envsubst app.template.yaml → app.yaml
  post-deploy.sh             snapshot deploy + reapply user_api_scopes:["sql"]
  dev.sh                     local dev servers
  dev/                       one-off SQL probes (see scripts/dev/README.md)
```

## Data contract

SQL queries assume Unity Catalog views in `connected_plant_uat.gold`:

```
gold_batch_lineage              parent/child edges with LINK_TYPE
gold_batch_stock_v              per-plant stock (UNRESTRICTED, BLOCKED, ...)
gold_batch_mass_balance_v       postings with POSTING_DATE, MOVEMENT_TYPE
gold_batch_delivery_v           deliveries with CUSTOMER_ID, COUNTRY_ID
gold_batch_quality_lot_v        inspection lots
gold_batch_quality_result_v     MIC-level inspection results
gold_batch_quality_summary_v    per-batch rollup counts
gold_batch_coa_results_v        CoA-ready MIC results
gold_batch_production_history_v per-material batch history
gold_batch_summary_v            manufacture/expiry dates, shelf-life status
gold_material                   material metadata
gold_plant                      plant metadata
gold_supplier                   vendor master
```

Catalog and schema are parameterised via `TRACE_CATALOG` / `TRACE_SCHEMA`
(see `app.template.yaml`). Point at a different workspace by editing those.

## Endpoints

All requests are `POST` and require a material + batch id (except
`/api/health`, `/api/ready`). Auth is handled by the Databricks Apps proxy
via `x-forwarded-access-token`.

```
POST /api/health                  liveness
POST /api/ready                   readiness probe (needs DATABRICKS_READINESS_TOKEN)
POST /api/trace                   recursive lineage tree
POST /api/summary                 legacy totals
POST /api/batch-details           summary + CoA + customers + cross-batch + movement
POST /api/impact                  customers + cross-batch exposure
POST /api/recall-readiness        batch exposure page
POST /api/bottom-up               upstream lineage page
POST /api/top-down                downstream lineage + deliveries page
POST /api/mass-balance            per-day delta + running cumulative
POST /api/quality                 inspection lots + MIC results + summary
POST /api/production-history      batches for the material
POST /api/batch-compare           production + quality rollups across batches
POST /api/supplier-risk           suppliers in the ancestor chain
POST /api/coa                     CoA results
```

## Batch picker

`App.tsx` ships with a material/batch input bar above every page. Type any
`(material_id, batch_id)` pair from `connected_plant_uat.gold.gold_batch_summary_v`
and press Load to repopulate every page. The reference batch baked in as the
default is `20582002 / 0008898869`.

## Dev

```
bash scripts/dev.sh
```

Starts uvicorn on `:8000` and Vite on `:5173`. Vite proxies `/api` to uvicorn.
For local auth, either (a) run behind `databricks apps proxy`, or (b) set
`Authorization: Bearer <PAT>` on requests.

## Deploy

One command, replaces `make deploy`:

```
bash scripts/deploy.sh                   # defaults to --profile uat
bash scripts/deploy.sh --profile prod
```

The script chains: auth check → frontend build → render `app.yaml` →
`databricks bundle deploy` → post-deploy snapshot + reapply
`user_api_scopes: ["sql"]`.

### `sync.include` caveat

`.gitignore` excludes `app.yaml` and `frontend/dist/`, which
`databricks bundle deploy` respects. To force them into the workspace upload,
`databricks.yml` declares:

```yaml
sync:
  include:
    - app.yaml
    - frontend/dist/**
```

Without this block, deploys succeed but the app starts with "No command to run"
(missing `app.yaml`) and a 404 frontend (missing `dist/`). Don't remove it.

### Post-deploy scope reset

`databricks bundle deploy` resets `user_api_scopes` to empty each run, which
breaks the `x-forwarded-access-token` SQL passthrough. `scripts/post-deploy.sh`
re-applies `user_api_scopes: ["sql"]` via `databricks apps update`. Run
`deploy.sh` instead of `databricks bundle deploy` directly.

## Probing UAT data

See `scripts/dev/README.md` for `run_sql.py`, `run_sql_named.py`, and the
per-page probe scripts. Useful when validating DAL changes before a deploy.
