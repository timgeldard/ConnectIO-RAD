# ConnectedQuality

ConnectedQuality is a cross-app façade that aggregates Trace, EnvMon, SPC, Lab, and Alarms behind a single `/api/cq` namespace. It is deployed both as a standalone Databricks App and as part of the unified Platform shell (mounted at `/cq`).

## Purpose

Rather than requiring the frontend to call five separate backends, CQ exposes one cohesive API rooted at `/api/cq`. Each domain area is a thin routing layer that delegates to shared DAL libraries — no business logic is duplicated here.

## Backend structure

```
backend/connectedquality_backend/
├── routers/
│   ├── trace.py          # /api/cq/trace/* — recall readiness, lineage, mass balance
│   ├── envmon.py         # /api/cq/envmon/* — plant list, heatmap, history
│   ├── spc.py            # /api/cq/spc/* — scorecard, charts, process flow
│   ├── lab.py            # /api/cq/lab/* — lab failures, plants
│   └── alarms.py         # /api/cq/alarms — active alarms
├── application/
│   └── trace.py          # Delegates to shared_trace.TraceCoreDal
├── dal/
│   └── lab.py            # Lab failures query (CQ-specific schema)
├── user_preferences/     # /api/cq/me — display name, preferences
└── db.py                 # run_sql_async, tbl(), get_trace_core_dal()
```

## Key dependency decisions

**Trace routes** call `shared_trace.TraceCoreDal` directly via `get_trace_core_dal()` in `db.py`. The DAL is constructed with `shared_db.core.tbl` (resolves `TRACE_CATALOG`/`TRACE_SCHEMA` gold-layer views) and CQ's own concurrency-limited `run_sql_async`.

**EnvMon routes** delegate to `envmon_backend` application queries, reusing the same DAL used by the standalone envmon app.

**SPC routes** delegate to `spc_backend` application queries.

**Lab routes** use a CQ-local DAL in `dal/lab.py` — the lab failures view is not yet in a shared library.

## Env vars

| Variable | Purpose | Default |
|---|---|---|
| `CQ_CATALOG` | Unity Catalog for CQ-specific views | falls back to `TRACE_CATALOG` |
| `CQ_SCHEMA` | Schema for CQ-specific views | falls back to `POH_SCHEMA` → `csm_process_order_history` |
| `TRACE_CATALOG` / `TRACE_SCHEMA` | Gold-layer lineage views used by `TraceCoreDal` | required |
| `SQL_CONCURRENCY_LIMIT` | Max in-flight Databricks SQL requests | `4` |

## Running locally

```bash
cd apps/connectedquality/backend
uv run --no-sync uvicorn connectedquality_backend.main:app --reload
```

## Tests

```bash
cd apps/connectedquality/backend
uv run --no-sync python -m pytest
```

Coverage floor: 75%.
