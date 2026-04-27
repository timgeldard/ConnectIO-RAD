# API Reference

## Current endpoints

```
GET  /api/health
GET  /api/ready
```

Both come from `shared_api`. `/api/health` returns a static liveness payload;
`/api/ready` returns `{"status": "ok"}` without probing SQL — see *Future
endpoints* for the readiness story once data routers exist.

## Future endpoints

The frontend currently consumes mock data from `frontend/src/data/mock.ts`.
The intended endpoint surface, once wired against
`connected_plant_uat.gold` views, is below. All endpoints should be `POST`,
rate-limited with `slowapi`, and tagged with freshness from
`shared_db.freshness`.

```
POST /api/orders                    list orders + filters (status, line, search, dateRange)
POST /api/orders/{id}               full order detail (BOM, pours, inspection, timeline)
POST /api/orders/{id}/coa           certificate of analysis bundle
POST /api/planning                  24h slots per line + backlog
POST /api/pours                     pour event log (filterable by line/date)
POST /api/pours/analytics           grouped breakdown (by operator/shift/line/source)
POST /api/kpis                      pour target/planned/actual rollup
```

## Auth

Identical to the other apps in the monorepo: the Databricks Apps proxy
forwards the user's OIDC token via `x-forwarded-access-token`. The backend
uses that token to authenticate SQL warehouse queries (no service principal).

## Catalog / schema

`POH_CATALOG` (default `connected_plant_uat`) and `POH_SCHEMA` (default
`gold`) are passed through `app.template.yaml`. SQL helpers use the standard
`tbl()` resolver and `:param` placeholders — see `apps/trace2/backend/dal/`
for the canonical pattern.
