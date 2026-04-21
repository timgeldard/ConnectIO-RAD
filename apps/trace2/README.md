# trace2 — Batch Traceability

Databricks App: FastAPI backend + Vite/React frontend for batch-level traceability
(Meridian Ingredients reference data).

## Layout

```
backend/    FastAPI app, token-passthrough SQL, trace DAL
frontend/   Vite + React + TypeScript, 9 pages of UX
scripts/    deploy + dev helpers
```

Backend utilities (`db.py`, `rate_limit.py`) and trace lineage DAL are ported
from the `spc` project. SQL queries in `trace_dal.py` assume Unity Catalog
tables in `connected_plant_uat.gold` — adapt schema + queries for your data.

## Dev

```
bash scripts/dev.sh
```

Starts uvicorn on `:8000` and Vite on `:5173` (Vite proxies `/api` to uvicorn).

## Deploy

```
make deploy PROFILE=uat
```

See `Makefile` and `scripts/post-deploy.sh` for the DABs + re-applying
`user_api_scopes: ["sql"]` step.
