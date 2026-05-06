# processorderhistory — Process Order History

Databricks App: FastAPI backend + Vite/React/TypeScript frontend providing a
plant-floor view of process order execution. Four pages cover the order list,
per-order detail (BOM, pours, quality, timeline), the daily planning board, and
pour analytics.

The current build is a faithful port of the Claude Design handoff prototype.
The frontend ships against in-memory mock data (`src/data/mock.ts`); the
backend exposes only health/readiness endpoints. Wiring against
`connected_plant_uat.gold` views is tracked in `docs/architecture.md`.

## 📚 Documentation

- [**Architecture Overview**](./docs/architecture.md): components, page flow, and the work remaining to swap mock data for gold views.
- [**Local Setup Guide**](./docs/setup.md): prerequisites and how to run locally.
- [**API Reference**](./docs/api.md): backend endpoints (health/ready today; future SQL routers).

## Layout

```
backend/
  main.py                       FastAPI entry, health/ready + SPA serving
  routers/                      router stubs (orders, pours, planning) — not wired yet
  schemas/                      pydantic request models
  dal/                          (TBD) gold-view DAL
frontend/
  src/App.tsx                   Top-level layout, view router, language provider
  src/ui.tsx                    Sidebar, TopBar, StatusBadge, icons, formatters
  src/pages/                    OrderList, OrderDetail, PlanningBoard, PourAnalytics
  src/data/mock.ts              In-memory orders, pours, plants, materials
  src/i18n/resources.json       en/fr/es/de strings (consumed via shared-frontend-i18n)
  src/styles/                   colors_and_type.css, app.css (ported from prototype)
scripts/
  build.py                      Pre-bundle: copy shared libs + npm run build
docs/                           architecture.md, setup.md, api.md
```

## Endpoints (current)

```
GET  /api/health   liveness
GET  /api/ready    readiness probe stub
```

Future endpoints (see `docs/api.md`): orders list, order detail, planning slots,
pour-time analytics — all sourced from `connected_plant_uat.gold` views.

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
