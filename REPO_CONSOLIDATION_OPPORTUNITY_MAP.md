# Repo Consolidation Opportunity Map

This map extends the backend consolidation review into a repo-wide view across
backend services, frontend apps, Databricks deployment, data contracts,
dependencies, and tests. The goal is to identify consolidation work that reduces
drift without flattening app-specific product behavior.

This is a living tracker. As consolidation work progresses, update the status,
evidence, and next action here in the same change as the implementation or
planning update.

## Progress Tracker

| Opportunity | Status | Last update | Next action |
| --- | --- | --- | --- |
| Shared FastAPI app/runtime conventions | Completed | Added shared app factory, safe exception handling, health/readiness helpers, and SPA fallback registration; envmon, trace2, and SPC now use the shared runtime. | Keep app-specific debug/readiness extensions local while future shared API behavior is added. |
| Shared Databricks SQL runtime | Completed for envmon/trace2 | Added `SqlRuntime` and `DataFreshnessRuntime`; envmon and trace2 now use shared cache/read-write/freshness behavior while SPC remains app-owned. | Revisit SPC after its audit/exclusion behavior is protected by broader DAL tests. |
| Shared trace backend primitives | Baselined | Route map confirms the four shared SPC/trace2 trace endpoints and their rate limits/freshness sources. | Extract schemas/tree helpers and add conformance tests before moving DAL SQL. |
| Trace2-led deploy standardization | Completed | Added `scripts/deploy_app.py`, per-app `deploy.toml` manifests, and shared `make deploy` wiring for envmon, SPC, and trace2. | Use the shared wrapper for real Databricks profile deploy validation. |
| Frontend API/query standardization | Completed | Added `libs/shared-frontend-api`; envmon, SPC, and trace2 use shared transport helpers, and envmon/SPC use shared React Query defaults. | Keep trace2 response mapping local until the shared trace contract is introduced. |
| Repo consolidation scanner suite | Completed | Added `scripts/consolidation_audit.py`; reports were regenerated after Phase 1 deploy standardization. | Keep reports current with each consolidation phase. |
| Frontend build/dependency standardization | In progress | SPC React typings and TypeScript were aligned enough for typecheck; dependency drift report now includes shared frontend packages. | Continue remaining Vite/plugin/version alignment in a later build-standardization slice. |
| Carbon shell primitives | Deferred | Envmon/SPC share Carbon patterns; trace2 remains custom. | Revisit after backend/deploy drift stabilizes. |
| Data contract catalog | Baselined | SQL table map identifies shared Databricks view families and app-specific references. | Promote scanner output into a maintained data catalog after shared DB work starts. |
| Migration orchestration | Planned | Shared deploy wrapper now supports direct SQL migrations and after-bundle hooks; shared DB primitives are available for later migration runners. | Promote app migration hooks into a richer migration manifest after frontend transport work. |
| Test conformance | Baselined | `reports/consolidation/test-matrix.md` shows SPC has the broadest tests and envmon/trace2 lack frontend tests. | Add backend conformance tests with each shared package extraction. |
| SPC statistical utility extraction | Deferred | Domain-specific SPC logic should remain app-owned for now. | Revisit only after core shared infrastructure is stable. |

## Executive Ranking

| Rank | Opportunity | Area | Impact | Risk | Effort | Suggested timing |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Finish shared FastAPI app/runtime conventions | Backend | High | Low | Medium | Now |
| 2 | Create a shared Databricks SQL runtime | Backend/data | High | Medium | Medium | Now |
| 3 | Extract shared trace backend primitives | Backend/data | High | Medium | High | Now, staged |
| 4 | Standardize Databricks app deploy/render tooling | Deploy | High | Medium | Medium | Now |
| 5 | Standardize frontend API clients and query defaults | Frontend | Medium | Low | Medium | Now |
| 6 | Add a repo-level consolidation scanner suite | Tooling | Medium | Low | Medium | Now |
| 7 | Normalize frontend Vite/Nx/package conventions | Frontend/build | Medium | Low | Medium | Next |
| 8 | Consolidate Carbon shell primitives | Frontend UI | Medium | Medium | High | Next |
| 9 | Build a data contract and SQL reference catalog | Data | Medium | Medium | Medium | Next |
| 10 | Standardize migration orchestration | Data/deploy | Medium | Medium | Medium | Next |
| 11 | Improve app-level test conformance | Testing | Medium | Low | Medium | Continuous |
| 12 | Keep SPC statistical logic app-owned for now | Backend/domain | Low | High | High | Later |

## High Priority Opportunities

### 1. Finish Shared FastAPI App Runtime Conventions

The first consolidation slice added `libs/shared-api` and moved same-origin
middleware into a shared package. The next step is to make shared API behavior a
deliberate runtime layer instead of app-by-app wiring.

Candidate shared API capabilities:

- Same-origin middleware and CORS policy.
- Health and readiness response shapes.
- Static frontend mounting behavior.
- App metadata injection, including name, version, docs mode, and deployment
  environment.
- Common exception and Databricks runtime error mapping.
- Rate-limit setup conventions.

Evidence:

- The three apps use similar backend app setup, health checks, readiness checks,
  static fallback behavior, and Databricks token handling.
- SPC already imports the shared same-origin middleware through
  `apps/spc/backend/utils/security.py`.
- Envmon and trace2 now use the shared middleware directly.

Suggested package shape:

```text
libs/shared-api/src/shared_api/
  app_factory.py
  errors.py
  health.py
  security.py
  static.py
```

First ticket:

- Add `create_databricks_app(config)` with opt-in pieces rather than a rigid
  framework.
- Migrate one smaller app first, likely envmon, then trace2, then SPC.
- Keep routers app-owned.

### 2. Create a Shared Databricks SQL Runtime

Each backend has grown its own Databricks SQL helpers: token resolution, table
qualification, query execution, freshness checks, caching, runtime error
classification, and auditing. This is the highest-value backend consolidation
after the API middleware work.

Candidate shared capabilities:

- `SqlRuntime` wrapper around Databricks Statement Execution.
- Read-through cache for idempotent `SELECT` and metadata queries only.
- Freshness lookup helper.
- Table name resolver using a typed app data catalog.
- Consistent token resolution and warehouse config checks.
- Consistent runtime error classification and operational alert hooks.
- Optional audit sink that can be app-specific.

Evidence:

- Envmon still contains an SPC-named audit helper at
  `apps/envmon/backend/utils/db.py:190`.
- Trace2 contains the same SPC-named audit helper at
  `apps/trace2/backend/utils/db.py:141`.
- Trace2 also carries SPC exclusion snapshot write logic at
  `apps/trace2/backend/utils/db.py:220`, which appears domain-specific to SPC
  and should either be removed from trace2 or generalized behind an app
  capability.
- The previous consolidation fixed trace2 query caching so non-read statements
  are not cached and write statements clear cache entries. That behavior belongs
  in one shared SQL runtime.

Suggested package shape:

```text
libs/shared-db/src/shared_db/
  runtime.py
  statements.py
  freshness.py
  errors.py
  tables.py
  audit.py
```

First ticket:

- Move read/write detection, statement execution, cache invalidation, and
  freshness lookup into `shared-db`.
- Replace envmon and trace2 DB helpers with thin app adapters.
- Leave SPC on the old path until its larger DAL has dedicated tests around
  exclusion/audit behavior.

### 3. Extract Shared Trace Backend Primitives

SPC and trace2 share a core traceability domain. Trace2 extends it with more
recall and batch-analysis pages, but the first four endpoints are direct
consolidation candidates.

Shared endpoint candidates:

- `/trace`
- `/summary`
- `/batch-details`
- `/impact`

Evidence:

- SPC defines `/trace` at `apps/spc/backend/routers/trace.py:26`,
  `/summary` at `apps/spc/backend/routers/trace.py:61`, `/batch-details` at
  `apps/spc/backend/routers/trace.py:87`, and `/impact` at
  `apps/spc/backend/routers/trace.py:120`.
- Trace2 defines the same endpoints at `apps/trace2/backend/routers/trace.py:37`,
  `apps/trace2/backend/routers/trace.py:72`,
  `apps/trace2/backend/routers/trace.py:98`, and
  `apps/trace2/backend/routers/trace.py:131`.
- Trace2 then extends the router with recall and analysis pages, including
  `/recall-readiness` at `apps/trace2/backend/routers/trace.py:154`, shared
  page source mapping at `apps/trace2/backend/routers/trace.py:190`, and page
  endpoints from `apps/trace2/backend/routers/trace.py:273` onward.

Suggested package shape:

```text
libs/shared-trace/src/shared_trace/
  schemas.py
  dal.py
  router.py
  freshness_sources.py
  tree.py
```

Consolidation boundary:

- Move generic trace request schemas, tree building, core DAL queries, and core
  endpoint assembly into `shared-trace`.
- Keep trace2-only recall readiness, CoA, mass balance, supplier risk, and
  page-specific transformations in trace2 until their data contracts stabilize.
- Keep SPC-specific SPC charting, rules, exclusions, and Genie routes in SPC.

First ticket:

- Extract request schemas and `_build_tree` first.
- Add shared conformance tests that run against both SPC and trace2 routers.
- Only then move DAL SQL.

### 4. Standardize Databricks App Deploy and Render Tooling

The app deployment layer has the clearest operational duplication. Each app has
its own Makefile and render/deploy scripts, with different template syntaxes and
different post-deploy behavior.

Candidate shared capabilities:

- Render `app.yaml` from app metadata and environment variables.
- Validate required variables before deploy.
- Build frontend/backend assets consistently.
- Deploy Databricks app bundle.
- Run configured SQL migrations.
- Apply post-deploy permissions and app scopes.
- Emit a consistent deployment summary.

Evidence:

- Envmon, SPC, and trace2 each define app-level Makefiles and
  `app.template.yaml`.
- Envmon uses `${VAR}` placeholder syntax while SPC and trace2 use `$VAR`.
- Envmon and SPC declare `databricks_cli_version >=0.283.0`; trace2 currently
  omits that pin.
- Trace2 comments that DAB schema does not support `user_api_scopes` and uses
  post-deploy repair logic, while envmon and SPC include app scopes in bundle
  config.
- SPC has the most complete migration and Databricks SQL API patterns, but they
  are currently embedded in a large app Makefile.

Suggested package shape:

```text
scripts/deploy_app.py
scripts/render_app_config.py
scripts/run_migrations.py
apps/<app>/deploy.toml
```

First ticket:

- Introduce a declarative per-app deploy manifest and use it for one app.
- Standardize template syntax before moving all apps.
- Preserve app-specific post-deploy hooks.

### 5. Standardize Frontend API Clients and Query Defaults

The frontend apps solve the same transport problems in three different ways:
typed JSON fetches, API error parsing, React Query cache defaults, and mutation
invalidation.

Candidate shared capabilities:

- `ApiError`.
- `fetchJson`, `postJson`, `deleteJson`.
- JSON error body parsing.
- Query key naming conventions.
- Query client defaults.
- Databricks auth and credential policy.
- Test helpers for API error cases.

Evidence:

- Envmon has React Query hooks in `apps/envmon/frontend/src/api/client.ts`.
- SPC has a smaller generic API client in `apps/spc/frontend/src/api/client.ts`.
- Trace2 has a larger custom client and response mapper in
  `apps/trace2/frontend/src/data/api.ts`.
- Envmon and SPC use React Query; trace2 does not yet.

Suggested package shape:

```text
libs/shared-frontend-api/src/
  client.ts
  errors.ts
  queryClient.ts
  testUtils.ts
```

First ticket:

- Extract `ApiError` and generic JSON helpers first.
- Adopt shared query client defaults in envmon and SPC.
- Leave trace2 page-level response mapping local until the shared trace backend
  contracts settle.

### 6. Add a Repo-Level Consolidation Scanner Suite

Manual review found useful patterns quickly, but it should be repeatable. Add
small scripts that produce objective drift reports and make future consolidation
work easier to prioritize.

Recommended scanners:

- Route map generator: emits app, method, path, router module, handler name,
  rate limit, and freshness sources.
- SQL table reference extractor: emits table/view references by app and module.
- Dependency drift report: compares package versions across frontend
  `package.json` and backend `pyproject.toml`.
- Frontend API call map: emits endpoint paths, method usage, and client helper
  usage.
- Deploy script linter: compares Databricks CLI pins, app scope handling,
  template syntax, required variables, and migration hooks.
- Test coverage matrix: emits backend/frontend test counts and missing
  conformance coverage by app.

Suggested output path:

```text
reports/consolidation/
  route-map.json
  sql-table-map.json
  dependency-drift.md
  frontend-api-map.json
  deploy-drift.md
  test-matrix.md
```

First ticket:

- Add `scripts/consolidation_audit.py` with read-only scanners and commit the
  generated markdown summaries.

## Medium Priority Opportunities

### 7. Normalize Frontend Build and Dependency Conventions

Envmon, SPC, and trace2 all use Vite and React, but their dependency and config
sets have drifted.

Observed drift:

- Envmon and SPC use Carbon, React Query, Sass, and Vite.
- Trace2 uses a much thinner React/Vite setup with custom inline styles.
- SPC currently carries frontend version drift, including React 18 paired with
  `@types/react` 19 and TypeScript 6.
- The three frontend `project.json` files define very similar Nx `dev`, `build`,
  and `typecheck` targets.
- Envmon and SPC use the `~` alias and richer chunk splitting. Trace2 has a
  simpler Vite config and no `~` alias.

Recommended consolidation:

- Add a shared Vite config helper for aliases, proxy, build output, and common
  chunks.
- Add shared Nx target templates or generator scripts.
- Align TypeScript, React typings, Vite, testing, and lint versions.
- Keep app-level chunk overrides where they are driven by real bundle profiles.

### 8. Consolidate Carbon Shell Primitives

Envmon and SPC both use Carbon shell patterns. Trace2 is currently a custom UI
and should not be forced into Carbon without a product/design decision.

Evidence:

- Envmon has a Carbon header, side nav, theme toggle, and content layout in
  `apps/envmon/frontend/src/components/layout/AppShell.tsx:22`.
- SPC has reusable shell props, header, sidebar, filter bar, and content region
  in `apps/spc/frontend/src/components/layout/AppShell.tsx:23`.
- Trace2 defines custom navigation and theme logic directly in
  `apps/trace2/frontend/src/App.tsx:25` and
  `apps/trace2/frontend/src/App.tsx:112`.

Recommended consolidation:

- Extract a `shared-ui` package for Carbon shell primitives used by envmon and
  SPC.
- Keep app-specific navigation items, filters, and main content local.
- Decide separately whether trace2 should move to Carbon or remain as a custom
  traceability workbench UI.

### 9. Build a Data Contract and SQL Reference Catalog

The apps share a number of Databricks views. Today those references are spread
across DAL modules, route freshness lists, deploy migrations, and docs.

Shared table/view families:

- Trace core: `gold_batch_lineage`, `gold_material`, `gold_plant`,
  `gold_batch_quality_summary_v`, `gold_batch_stock_v`.
- Trace details: `gold_batch_mass_balance_v`,
  `gold_batch_quality_result_v`, `gold_batch_quality_lot_v`,
  `gold_batch_delivery_v`.
- Trace2 extensions: `gold_batch_summary_v`,
  `gold_batch_coa_results_v`, `gold_batch_production_history_v`,
  `gold_supplier`.
- Envmon quality/inspection: `gold_inspection_lot`,
  `gold_inspection_point`, `gold_batch_quality_result_v`,
  `em_location_coordinates`.

Recommended consolidation:

- Add a typed data catalog for logical dataset names, physical table names,
  owning app, consumers, freshness support, and migration source.
- Generate freshness source lists and route docs from the catalog.
- Use the catalog as input to deploy/migration validation.

### 10. Standardize Migration Orchestration

SPC has the richest migration machinery, envmon has a targeted migration script,
and trace2 has post-deploy scripts. The repo needs one migration orchestrator
before more shared data contracts are added.

Recommended consolidation:

- Define app migration manifests.
- Track migration id, target catalog/schema, prerequisites, and rollback notes.
- Run migrations through the same SQL runtime used by backends where possible.
- Keep destructive migrations explicitly gated.

### 11. Improve App-Level Test Conformance

Test coverage is uneven across apps and layers. This makes shared extraction
riskier than necessary.

Observed coverage shape:

- SPC backend has the broadest test suite.
- SPC frontend has the only sizeable frontend test suite.
- Envmon backend has a small focused backend suite.
- Trace2 backend has a small focused backend suite.
- Envmon and trace2 frontend have no comparable frontend tests.

Recommended consolidation:

- Add shared backend conformance tests for health, readiness, same-origin
  middleware, token resolution, and SQL runtime behavior.
- Add frontend API client tests that can be reused across apps.
- Add route contract tests for shared trace endpoints before moving DAL code.
- Add minimal smoke tests for envmon and trace2 frontend app mounting.

## Lower Priority or Avoid for Now

### Keep SPC Statistical Utilities App-Owned

SPC-specific Western Electric rules, chart calculations, exclusions, and Genie
workflows are domain-specific. They may eventually produce shared statistical
utilities, but extracting them before trace/db/deploy consolidation would create
more abstraction than value.

### Do Not Force Trace2 Into Carbon Yet

Trace2 has a distinct custom workbench feel and large inline UI surface. A
shared Carbon shell may be right later, but the product decision should come
first.

### Do Not Overbuild Shared Auth Yet

`libs/shared-auth` exists as a stub, but the active common problem today is token
resolution and Databricks app identity handling, not a full auth domain model.
Grow shared auth only when claims, roles, or cross-app authorization rules become
real requirements.

## Suggested First Five Tickets

1. Finish `shared-api` app factory and health/readiness helpers.
2. Create `shared-db.SqlRuntime` and move cache/read/write/freshness behavior
   into it.
3. Remove or generalize SPC-named audit and exclusion helpers from envmon and
   trace2.
4. Extract shared trace request schemas, tree building, and conformance tests
   before moving DAL SQL.
5. Add `scripts/consolidation_audit.py` with route, SQL table, dependency,
   deploy, and test matrix reports.

## Best-Practice Guardrails

- Consolidate behavior only where at least two apps have the same production
  invariant.
- Prefer app adapters over shared frameworks for the first pass.
- Move code in small slices with conformance tests around the shared contract.
- Keep domain language app-specific unless it is genuinely cross-app.
- Generate maps and reports from source files instead of maintaining duplicate
  inventories by hand.
- Avoid changing UI design systems as part of backend or deploy consolidation.
- Treat Databricks table/view references as data contracts, not incidental
  strings.

## Recommended Next Implementation Slice

Phase 0 through Phase 4 are complete. The next slice should be the shared trace
contract:

```text
libs/shared-trace/src/shared_trace/schemas.py
libs/shared-trace/src/shared_trace/tree.py
libs/shared-trace/src/shared_trace/freshness_sources.py
```

Start with request schemas, tree building, and conformance tests for `/trace`,
`/summary`, `/batch-details`, and `/impact`. Move DAL SQL only after both SPC
and trace2 pass the shared route contracts.
