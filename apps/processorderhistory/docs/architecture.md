# Process Order History — Architecture

## What this app is

A plant-floor view of process order execution. Operators and supervisors at a
single Kerry plant use it to:

1. **List** every process order over the last 30 days, filtered by status,
   product category, line and free-text search.
2. **Drill** into one order to see its BOM (bill of materials), pours,
   inspection/quality results, timeline, and material balance.
3. **Plan** the next 24 hours across production lines on a Gantt-style board,
   spotting clashes and unscheduled backlog.
4. **Analyse** pours (goods-issues) per operator, shift, line and source area
   to surface bottlenecks and target/plan/actual gaps.

The frontend is a faithful port of the Claude Design handoff prototype
(`process-order-history-handoff.zip`); component structure, CSS, and copy
match the prototype 1:1. The backend is a FastAPI shell exposing only health
and readiness endpoints — see *Wiring real data* below.

## Components

```
frontend/src/App.tsx                    Top-level layout + view router (list / detail / analytics pages)
frontend/src/ui.tsx                     Sidebar, TopBar, StatusBadge, Check, Sparkline, fmt, icons
frontend/src/i18n/context.tsx           Local LangProvider/useT() hook used by every page
frontend/src/i18n/dictionary.ts         Strings keyed by `t.foo` (en/fr/de/es)
frontend/src/i18n/resources.json        Namespaced poh.* keys for validate_i18n.py (not runtime)
frontend/src/api/                       Typed fetch helpers + response mappers, one file per endpoint
frontend/src/pages/OrderList.tsx        Order list + filters + KPI strip
frontend/src/pages/OrderDetail.tsx      Detail: header, BOM, movements, inspection, timeline
frontend/src/pages/PlanningBoard.tsx    ±7-day Gantt + backlog rail
frontend/src/pages/PourAnalytics.tsx    Pour trend charts + group-by breakdown + KPI tiles
frontend/src/pages/YieldAnalytics.tsx   Yield % trend + per-order drill-through
frontend/src/pages/QualityAnalytics.tsx RFT trend + inspection result cards
backend/main.py                         FastAPI entry, /api/health + /api/ready + 8 data routers + SPA fallback
backend/db.py                           SQL helpers: tbl(), silver_tbl(), validate_timezone(), run_sql_async
backend/routers/orders.py              POST /api/orders — order list
backend/routers/order_detail_router.py GET /api/orders/{id} — full order detail
backend/routers/pours_router.py        POST /api/pours/analytics
backend/routers/yield_router.py        POST /api/yield/analytics
backend/routers/quality_router.py      POST /api/quality/analytics
backend/routers/day_view_router.py     POST /api/dayview
backend/routers/planning_router.py     POST /api/planning/schedule
backend/routers/me_router.py           GET /api/me
backend/dal/                            One DAL module per router; all SQL lives here
backend/schemas/                        Pydantic request models
```

The view router is a tiny custom switcher in `App.tsx` (no React Router
dependency). State for cross-view drill-throughs (order detail from planning,
pour analytics from KPI strip) is exposed via two `window` hooks
(`__navigateToOrder`, `__navigateToPourAnalytics`) — preserved verbatim from
the prototype to keep the JSX→TSX port mechanical.

## Data layer

All SQL queries target gold-layer views only (Rule 1.1).  `day_view_dal` and
`planning_dal` are approved exceptions that also read
`silver.silver_process_order` for `PROCESS_LINE` and `SCHEDULED_START` columns
not yet promoted to a gold view.

Catalog and schema come from `POH_CATALOG` / `POH_SCHEMA` env vars (rendered
from `app.template.yaml`).  SQL helpers use `tbl()` for the app schema and
`silver_tbl()` for the silver layer.  All user-supplied values use `:param`
named parameters — never f-string interpolation.

## i18n

Two parallel artefacts, generated together once from the prototype's
`i18n.js` and **not currently wired to stay in sync**:

- `dictionary.ts` — flat object access (`t.statusRunning`) used by every JSX
  ported component. This is what actually renders at runtime.
- `resources.json` — namespaced (`poh.*`) keys required by
  `validate_i18n.py`. Generated from the prototype's strings via
  `tools/convert_i18n.py` (kept in the handoff archive); not consumed by the
  runtime today.

If you change `dictionary.ts`, update `resources.json` by hand (or rerun the
converter against the modified dictionary) — there is no automated sync. The
contract validator only enforces structural parity (same keys / placeholders
across en/fr/es/de), not equivalence with the TS dictionary.

When the app moves to the shared `@connectio/shared-frontend-i18n` provider,
collapse to a single source of truth: replace `LangProvider` in `App.tsx`
with `I18nProvider`, rewrite each `t.foo` site to `t('poh.foo')`, and
delete `dictionary.ts`.

## Status

| Surface | State |
|---|---|
| Frontend pages | ✅ all pages wired to real data (orders, detail, pours, planning, day view, yield, quality) |
| Frontend i18n | en/fr/de/es ported; `dictionary.ts` and `resources.json` not auto-synced |
| Backend health/ready | ✅ |
| Backend routers | ✅ 8 data endpoints live — orders, detail, pours, yield, quality, day view, planning, /me |
| Tests | 133 passing; 96% overall coverage |
| Deploy | `make deploy PROFILE=uat` works once shared libs are present |
