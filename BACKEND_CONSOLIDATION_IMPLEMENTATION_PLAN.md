# Backend Consolidation Implementation Plan

Branch: `codex-magic`

## Goal

Consolidate the backend platforms for `spc`, `envmon`, and `trace2` into shared, tested modules while preserving app-specific domain behavior. The target is not to make the apps identical; it is to make the common runtime boring, secure, observable, and reusable.

## Guiding Principles

1. Preserve behavior before moving code.
   Add tests around current behavior before extracting shared modules.

2. Consolidate platform code first.
   Shared FastAPI setup, middleware, readiness, SQL execution, freshness, and trace primitives should move before domain analytics.

3. Keep domain ownership clear.
   SPC statistics, envmon heatmap rules, and trace2 recall/batch pages should remain app-owned unless a second app truly needs the same behavior.

4. Migrate by compatibility shims.
   Existing imports such as `backend.utils.db` should keep working while internals move into shared packages.

5. Feature-gate shared routers.
   Shared modules should expose explicit feature options rather than forcing every app to serve every endpoint.

6. Make deployment repeatable.
   App config rendering, Databricks app deployment, OAuth scopes, and migrations should be driven by one common pattern.

7. Prefer small, reviewable PRs.
   Each phase below should be split into PR-sized steps with tests and rollback paths.

## Target Architecture

### Shared Packages

Proposed packages:

- `libs/shared-api`
  - FastAPI app factory
  - Global exception handler
  - Health/readiness/debug endpoint helpers
  - Static SPA serving helper
  - Same-origin middleware
  - Optional latency middleware

- `libs/shared-db`
  - Databricks SQL executors
  - Config and token helpers
  - Configurable async SQL runtime
  - Cache policies
  - Error classification
  - Data freshness helpers
  - Audit helper primitives

- `libs/shared-trace`
  - Common trace request schemas
  - Common trace DAL functions
  - Feature-gated trace router builder
  - Shared trace source-view freshness mappings

- `libs/shared-auth`
  - Keep minimal for now
  - Later: token claims/JWT validation if required

### App Packages

Apps remain responsible for:

- App-specific router registration.
- Domain-specific DALs and analytics.
- App-specific readiness checks.
- App-specific migrations.
- App-specific env config.
- App-specific frontend/static artifact build.

## Phase 0: Baseline And Safety Net

### Tasks

1. Add a consolidation checklist to the repo.
2. Add backend smoke tests for `envmon` and `trace2`.
3. Add focused regression tests for existing SQL wrapper behavior.
4. Record current route tables for all three apps.
5. Record current package/dependency inventory.

### Tests To Add

- `apps/envmon/backend/tests/test_main.py`
  - `/api/health` returns `{"status": "ok"}`.
  - `/api/ready` returns 503 when warehouse config is missing.
  - SPA fallback returns backend-running payload when frontend is not built.

- `apps/trace2/backend/tests/test_main.py`
  - `/api/health` returns `{"status": "ok"}`.
  - `/api/ready` returns 503 when readiness token is missing.
  - `/api/health/debug` returns 404 outside development.

- `apps/trace2/backend/tests/test_db_cache.py`
  - Read statements are cacheable.
  - Write statements are not cached.
  - Write statements clear read cache.

### Acceptance Criteria

- `nx run spc-backend:test` remains green.
- `nx run envmon-backend:test` has meaningful smoke coverage.
- `nx run trace2-backend:test` has meaningful smoke coverage.
- No shared extraction starts before these tests exist.

## Phase 1: Shared API Platform

### Tasks

1. Create `libs/shared-api`.
2. Move SPC `SameOriginMiddleware` into `shared-api`.
3. Add tests for same-origin behavior in `shared-api`.
4. Add an app factory:

   ```python
   create_app(
       title: str,
       routers: list[RouterMount],
       static_dir: Path,
       readiness_checks: list[ReadinessCheck],
       debug_info: Callable[..., dict] | None = None,
       enable_same_origin: bool = True,
       latency_budgets: dict[str, int] | None = None,
   ) -> FastAPI
   ```

5. Migrate `envmon` first because its `main.py` is simplest.
6. Migrate `trace2`.
7. Migrate `spc` last, preserving latency budgets and schema readiness.

### Best-Practice Notes

- Keep `main.py` files as composition roots only.
- Do not hide router registration behind magic discovery.
- Use explicit typed config objects.
- Keep readiness checks composable and independently testable.
- Do not make debug endpoints available unless `APP_ENV=development`.

### Acceptance Criteria

- The three apps expose the same health, readiness, exception, and SPA behavior shape.
- Same-origin protection is enabled for all mutating browser-origin requests.
- App-specific readiness checks still work:
  - SPC includes SQL and gold schema contract checks.
  - Trace2 includes SQL check.
  - Envmon includes SQL check and can later add coordinate-table migration readiness.

## Phase 2: Shared SQL Runtime

### Tasks

1. Add `SqlRuntime` to `shared-db`.
2. Add cache policy types:

   ```python
   CachePolicy.disabled()
   CachePolicy.single(maxsize: int, ttl: int, row_limit: int)
   CachePolicy.tiered(tiers: list[CacheTier])
   ```

3. Add read/write statement classification to `shared-db`.
4. Add write invalidation behavior.
5. Add connector selection using a standard env var:
   - Canonical: `SQL_EXECUTOR`
   - Backward compatible: also read `SPC_SQL_EXECUTOR` for SPC during migration.
6. Add optional audit hook support:

   ```python
   async def audit_hook(statement, params, rows, duration_ms, endpoint_hint): ...
   ```

7. Migrate `envmon` to `SqlRuntime.single`.
8. Migrate `trace2` to `SqlRuntime.single` and fix write caching.
9. Migrate `spc` to `SqlRuntime.tiered` with query audit hook.
10. Keep `apps/*/backend/utils/db.py` as re-export compatibility shims.

### Best-Practice Notes

- Cache only read-only statements.
- Always deep-copy cached row payloads on read and write.
- Never include raw token values in logs or cache diagnostics.
- Keep SQL executor internals private; expose tested runtime functions.
- Standardize error mapping at the runtime boundary.

### Acceptance Criteria

- Repeated writes execute every time.
- Writes invalidate affected read caches.
- SPC query audit still records endpoint, params, row count, duration, warehouse, and user identity.
- Envmon and trace2 no longer carry duplicate cache-key/freshness boilerplate.
- Existing imports continue working.

## Phase 3: Shared Data Freshness And Audit Primitives

### Tasks

1. Move freshness query construction to `shared-db`.
2. Add `FreshnessService` or helper functions:

   ```python
   get_data_freshness(token, source_views, runtime, catalog, schema)
   attach_data_freshness(payload, token, source_views, options)
   ```

3. Support app-specific error behavior through options:
   - `alert_subject`
   - `audit_on_failure`
   - `best_effort`
   - `request_path`
4. Rename generic audit helpers:
   - `insert_spc_audit_event` -> `insert_audit_event`
   - `insert_spc_exclusion_snapshot` -> keep SPC-only unless truly shared.
5. Remove unused SPC-named helpers from envmon and trace2 if they are not used.

### Best-Practice Notes

- Shared helpers should not mention SPC unless they write SPC tables.
- Freshness failures should be consistent but configurable.
- Do not let freshness attachment mutate caller payload unexpectedly unless documented. Prefer returning a shallow copy.

### Acceptance Criteria

- All apps produce the same `data_freshness` shape.
- SPC retains richer audit behavior on freshness failures.
- Envmon/trace2 no longer contain SPC-named audit helpers unless they use SPC tables intentionally.

## Phase 4: Shared Trace Module

### Tasks

1. Create `libs/shared-trace`.
2. Move common trace request validators and schemas.
3. Move shared DAL functions used by both SPC and trace2.
4. Build a router factory:

   ```python
   build_trace_router(
       features: set[TraceFeature],
       dal: TraceDal,
       freshness: FreshnessAdapter,
   )
   ```

5. Define features:
   - `core`: `/trace`, `/summary`, `/batch-details`, `/impact`
   - `recall`: `/recall-readiness`
   - `batch_pages`: `/coa`, `/mass-balance`, `/quality`, `/production-history`, `/batch-compare`, `/bottom-up`, `/top-down`, `/supplier-risk`
6. Migrate SPC with `features={"core"}`.
7. Migrate trace2 with `features={"core", "recall", "batch_pages"}`.

### Best-Practice Notes

- Keep route paths stable.
- Keep request/response shapes stable.
- Do not make SPC serve trace2-only endpoints accidentally.
- Keep large SQL fragments in DAL modules, not routers.
- Add golden route-registration tests.

### Acceptance Criteria

- SPC route list is unchanged.
- Trace2 route list is unchanged.
- Common trace behavior is implemented once.
- Trace2-specific batch pages remain feature-gated.

## Phase 5: Dependency And Tooling Cleanup

### Tasks

1. Decide canonical backend dependency source:
   - Preferred: `pyproject.toml` + `uv.lock`.
   - Mark `requirements.txt` files as legacy or remove them once deploy scripts no longer use pip.
2. Lift shared runtime dependencies to shared packages.
3. Remove unused app-level dependencies:
   - `slowapi` if using in-house limiter.
   - duplicate connector declarations where shared-db owns connector use.
4. Standardize Python version and dependency floors.
5. Add `nx` targets for all shared libraries:
   - `test`
   - `lint`
   - `typecheck`
6. Add CI commands that run affected backend tests and shared package tests.

### Best-Practice Notes

- App packages should declare app-owned dependencies only.
- Shared packages should declare everything they import directly.
- Avoid relying on transitive dependencies from another app.

### Acceptance Criteria

- `uv sync --all-packages` works from repo root.
- Each backend package can test in isolation.
- Shared libraries are testable through Nx.
- No deploy path depends on stale requirements files.

## Phase 6: Deployment Standardization

### Tasks

1. Create a shared deploy/render script, for example `scripts/deploy_app.py`.
2. Make app-level Makefiles thin wrappers over the shared script.
3. Standardize app config rendering:
   - Warehouse path
   - Catalog/schema
   - App-specific env vars
   - Readiness token secret placeholders
4. Standardize Databricks app deploy behavior:
   - Build frontend.
   - Render app config.
   - Bundle deploy.
   - Trigger app snapshot deployment if needed.
   - Apply/reapply `user_api_scopes: ["sql"]`.
   - Run app-specific migrations.
5. Move migration lists into app-local config files.

### Best-Practice Notes

- Keep Databricks profile and target explicit.
- Avoid hard-coded app URLs in deploy scripts.
- Make migrations idempotent.
- Print what will run before it runs.

### Acceptance Criteria

- All three apps deploy through one shared path.
- OAuth SQL passthrough is consistently preserved.
- Migrations are app-specific but orchestrated consistently.
- Generated `app.yaml` behavior is documented and reproducible.

## Phase 7: Optional Later Consolidation

Do not do these until a real second use case appears:

- Move SPC statistical utilities into shared packages.
- Centralize envmon heatmap/risk algorithms.
- Centralize Genie-specific behavior.
- Build a generalized audit table abstraction across all apps.
- Add JWT/claims validation to `shared-auth`.

## Suggested PR Sequence

1. PR 1: Add tests for envmon/trace2 baseline and trace2 write-cache regression.
2. PR 2: Create `shared-api`, move same-origin middleware, apply to envmon/trace2.
3. PR 3: Migrate envmon `main.py` to shared app factory.
4. PR 4: Migrate trace2 `main.py` to shared app factory.
5. PR 5: Migrate SPC `main.py` to shared app factory.
6. PR 6: Add `shared_db.SqlRuntime` and migrate envmon.
7. PR 7: Migrate trace2 SQL wrapper and fix write caching.
8. PR 8: Migrate SPC SQL wrapper with tiered cache/audit preservation.
9. PR 9: Centralize freshness and audit primitives.
10. PR 10: Create shared trace schemas/router/DAL core and migrate SPC/trace2.
11. PR 11: Clean dependencies and legacy requirements usage.
12. PR 12: Standardize deploy/render flow.

## Definition Of Done

The consolidation is complete when:

- Platform backend behavior is implemented once and consumed by all three apps.
- App-local backend code mostly contains composition, routers, app config, and domain logic.
- Shared packages have their own tests.
- Envmon and trace2 have backend test coverage comparable to their risk.
- SPC's existing tests still pass.
- Route surfaces remain stable unless intentionally changed.
- Databricks deploy behavior is consistent across apps.
- No app carries copied SQL runtime/freshness/cache boilerplate.

## First Implementation Slice

Start with the smallest valuable slice:

1. Add trace2 DB regression tests for write caching.
2. Fix trace2 write caching locally.
3. Move `SameOriginMiddleware` into `shared-api`.
4. Enable same-origin middleware in envmon and trace2.
5. Add smoke tests proving mutating cross-origin requests are rejected.

This gives immediate safety and security wins before the larger shared-runtime refactor.

