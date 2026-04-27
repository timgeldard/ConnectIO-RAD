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
frontend/src/App.tsx                    Top-level layout + view router (list / detail / planning / pours)
frontend/src/ui.tsx                     Sidebar, TopBar, StatusBadge, Check, Sparkline, fmt, icons
frontend/src/i18n/context.tsx           Local LangProvider/useT() hook used by every page
frontend/src/i18n/dictionary.ts         Strings keyed by `t.foo` (en/fr/de/es)
frontend/src/i18n/resources.json        Generated from dictionary.ts; satisfies validate_i18n.py
frontend/src/data/mock.ts               Pseudo-random fixtures (orders, pours, planning, BOM, quality)
frontend/src/pages/OrderList.tsx        List + filters + KPI strip + pour KPIs
frontend/src/pages/OrderDetail.tsx      Detail (header, BOM, pours, inspection, timeline, allergens)
frontend/src/pages/PlanningBoard.tsx    24h Gantt + backlog rail
frontend/src/pages/PourAnalytics.tsx    Trend charts + group-by breakdown + KPI tiles + line filter
backend/main.py                         FastAPI entry, /api/health + /api/ready + SPA fallback
backend/{routers,schemas,dal}/          Stubs — to be filled when real data is wired
```

The view router is a tiny custom switcher in `App.tsx` (no React Router
dependency). State for cross-view drill-throughs (order detail from planning,
pour analytics from KPI strip) is exposed via two `window` hooks
(`__navigateToOrder`, `__navigateToPourAnalytics`) — preserved verbatim from
the prototype to keep the JSX→TSX port mechanical.

## Wiring real data

The prototype was built around the dashboard
`Process Order Cockpit 2026-03-18 19_49_53.lvdash.json` and references
`connected_plant_uat.csm_process_order_history.*` views. The path forward:

1. **DAL layer** under `backend/dal/` with query helpers against
   `connected_plant_uat.gold` (per CLAUDE.md: gold-only — never bronze/silver).
   Catalog and schema come from `POH_CATALOG` / `POH_SCHEMA` env (rendered
   from `app.template.yaml`).
2. **Routers** under `backend/routers/` — orders list/detail, pours, planning
   slots, KPI rollups. POST endpoints, rate-limited via slowapi, freshness
   tagged via `shared_db.freshness`.
3. **Replace** the `import { ORDERS, buildDetail, buildPlanningData,
   buildPoursData } from '~/data/mock'` calls with `fetch('/api/...')` +
   typed mappers, mirroring the trace2 `data/api.ts` pattern.

The `// @ts-nocheck` directives at the top of each ported source file are
intentional — they keep velocity on the initial port. As real types land
(once entities.yaml is extended with POH-specific tables), prefer tightening
them file-by-file rather than en bloc.

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
| Frontend pages | Ported from prototype; consume mock data |
| Frontend i18n | en/fr/de/es ported; later prototype keys backfilled with English |
| Backend health/ready | ✅ |
| Backend orders/pours/planning | ❌ — stubs only |
| Tests | One smoke test (renders OrderList against mock data) |
| Deploy | `make deploy PROFILE=uat` works once shared libs are present |
