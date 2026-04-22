# Backend Consolidation Review

Branch reviewed: `codex-magic`

## Scope

Reviewed the backend surface for the three apps now consolidated into this monorepo:

- `apps/spc/backend`
- `apps/envmon/backend`
- `apps/trace2/backend`

Also reviewed the shared backend libraries:

- `libs/shared-db`
- `libs/shared-auth`

The repository already has the right overall shape: a `uv` workspace defines all backend packages and shared libraries, and each app has an Nx backend project. The main opportunity now is to stop carrying copied root-repo code in each app and move repeated backend platform concerns into shared packages.

## Executive Summary

The strongest immediate consolidation candidates are:

1. FastAPI app bootstrapping: exception handling, health/ready endpoints, static SPA serving, docs URL settings, rate limit setup, and debug endpoints are repeated across all apps.
2. SQL utility wrappers: `spc`, `envmon`, and `trace2` each keep app-local variants of async SQL execution, cache keys, freshness lookup, audit helpers, and exclusion snapshot insertion.
3. Traceability backend: `spc` and `trace2` share the same trace router/DAL base, while `trace2` extends it with extra batch pages. This should become a shared trace module with an app-selected feature set.
4. Security middleware: `SameOriginMiddleware` is mature in `spc` but not applied to `envmon` or `trace2`.
5. Test coverage and package hygiene: `spc` has substantial backend tests, while `envmon` and `trace2` currently have no backend test files. Dependency versions and legacy `requirements.txt` usage are also inconsistent.

The work can be done incrementally. I would avoid a large one-shot move of SPC statistical logic; that code is domain-specific and currently the best-tested part of the backend.

## Current Backend Shape

### SPC

`apps/spc/backend/main.py` is the most complete backend host. It configures rate limiting, same-origin protection, latency logging/alerts, shared exception handling, health/readiness checks, debug endpoints, router registration, and SPA static serving. See `apps/spc/backend/main.py:53`, `apps/spc/backend/main.py:57`, `apps/spc/backend/main.py:72`, `apps/spc/backend/main.py:104`, `apps/spc/backend/main.py:126`, `apps/spc/backend/main.py:197`, and `apps/spc/backend/main.py:235`.

SPC also has the richest SQL wrapper. `apps/spc/backend/utils/db.py` re-exports `shared_db`, then adds tiered caches, executor selection, query audit, freshness, operational alerts, and exclusion snapshots. See `apps/spc/backend/utils/db.py:23`, `apps/spc/backend/utils/db.py:57`, `apps/spc/backend/utils/db.py:171`, `apps/spc/backend/utils/db.py:197`, `apps/spc/backend/utils/db.py:255`, `apps/spc/backend/utils/db.py:302`, and `apps/spc/backend/utils/db.py:416`.

### Envmon

`apps/envmon/backend/main.py` is a smaller FastAPI host with the same exception handler and SPA serving structure as the other apps, but it lacks SPC's same-origin middleware, debug endpoint, async readiness style, and schema-readiness pattern. See `apps/envmon/backend/main.py:30`, `apps/envmon/backend/main.py:42`, `apps/envmon/backend/main.py:64`, and `apps/envmon/backend/main.py:92`.

`apps/envmon/backend/utils/db.py` duplicates much of the SQL wrapper logic from SPC/trace2: cache key generation, read/write classification, executor selection, freshness lookup, audit insertion, and exclusion snapshot insertion. See `apps/envmon/backend/utils/db.py:54`, `apps/envmon/backend/utils/db.py:64`, `apps/envmon/backend/utils/db.py:94`, `apps/envmon/backend/utils/db.py:113`, `apps/envmon/backend/utils/db.py:146`, `apps/envmon/backend/utils/db.py:190`, and `apps/envmon/backend/utils/db.py:255`.

Envmon also has app-specific table configuration in `apps/envmon/backend/utils/em_config.py`. That is appropriate, but there is a small cleanup opportunity: `INSPECTION_TYPES_RAW` and `INSPECTION_TYPES` are defined twice at `apps/envmon/backend/utils/em_config.py:13` and `apps/envmon/backend/utils/em_config.py:37`.

### Trace2

`apps/trace2/backend/main.py` sits between SPC and envmon. It has async readiness and debug health like SPC, but not same-origin middleware or latency budgets. See `apps/trace2/backend/main.py:35`, `apps/trace2/backend/main.py:43`, `apps/trace2/backend/main.py:65`, `apps/trace2/backend/main.py:112`, and `apps/trace2/backend/main.py:132`.

Trace2's SQL wrapper is close to envmon's but less safe for writes: `apps/trace2/backend/utils/db.py:57` caches every statement by key without read/write classification or invalidation. That means an `INSERT`, `MERGE`, `UPDATE`, or `DELETE` routed through `run_sql_async` can be cached and skipped on repeat input. The app currently defines `insert_spc_exclusion_snapshot` at `apps/trace2/backend/utils/db.py:190`, so this is not just theoretical shared code drift.

Trace2's trace backend is a superset of SPC's trace backend. The first four trace endpoints are effectively common across both apps, while trace2 adds recall readiness and eight batch page endpoints. Compare `apps/spc/backend/routers/trace.py:26` through `apps/spc/backend/routers/trace.py:140` with `apps/trace2/backend/routers/trace.py:37` through `apps/trace2/backend/routers/trace.py:374`.

## Shared Libraries Today

`libs/shared-db` already centralizes core Databricks configuration, token resolution, table quoting, SQL parameter formatting, SQL executors, error classification, and rate limiting. Useful anchors are `libs/shared-db/src/shared_db/core.py:50`, `libs/shared-db/src/shared_db/core.py:66`, `libs/shared-db/src/shared_db/core.py:76`, `libs/shared-db/src/shared_db/core.py:99`, `libs/shared-db/src/shared_db/executors.py:77`, `libs/shared-db/src/shared_db/executors.py:167`, and `libs/shared-db/src/shared_db/rate_limit.py:119`.

The library is currently below the app wrappers in capability. The shared `run_sql_async` at `libs/shared-db/src/shared_db/core.py:122` uses a single cache and the REST executor only. It does not include write invalidation, connector selection, structured freshness lookup, audit helpers, or app-specific cache profiles.

`libs/shared-auth` is a stub with only token extraction. See `libs/shared-auth/src/shared_auth/middleware.py:4`. The repo TODO already calls this out at `TODO.md:25`.

## Consolidation Candidates

### 1. Shared FastAPI App Factory

Create a shared backend platform module, for example `libs/shared-api`, or add a focused submodule under `shared-db` if keeping package count low is preferred. It should expose a factory/helper that can:

- Create the `FastAPI` instance with `docs_url="/api/docs"` and `redoc_url=None`.
- Register `RateLimitExceeded`, `SlowAPIMiddleware`, and optionally `SameOriginMiddleware`.
- Add the standard global exception handler.
- Add `/api/health`.
- Add `/api/ready` with pluggable checks.
- Add optional `/api/health/debug`.
- Mount `/assets`, `/`, and the SPA catch-all using the same static serving behavior.

Current duplication points:

- SPC: `apps/spc/backend/main.py:53` through `apps/spc/backend/main.py:253`
- Envmon: `apps/envmon/backend/main.py:30` through `apps/envmon/backend/main.py:110`
- Trace2: `apps/trace2/backend/main.py:35` through `apps/trace2/backend/main.py:150`

Recommended design: keep each app's `main.py` as a thin composition file that only names the app, registers routers, chooses app-specific readiness checks, and configures optional middleware/features.

### 2. Promote Same-Origin Middleware

Move `apps/spc/backend/utils/security.py` into a shared package and apply it to all three apps by default. SPC already uses it at `apps/spc/backend/main.py:57`; envmon and trace2 do not.

This is low-risk and high-value because all three apps expose mutating routes:

- SPC exclusions and locked limits.
- Envmon coordinate upsert/delete.
- Trace2 batch analysis endpoints may be read-only today, but shared policy avoids future gaps.

### 3. Standardize SQL Execution and Caching

Move the common parts of the app wrappers into `shared_db`:

- Statement prefix detection.
- Read/write classification.
- Cache key generation.
- TTL cache handling with deep copies.
- Write invalidation.
- Executor selection via a standard env var, probably `SQL_EXECUTOR`.
- Optional per-app cache profile.
- Optional query audit hook.

Current duplication and drift:

- SPC has read/write classification and tiered caches: `apps/spc/backend/utils/db.py:101`, `apps/spc/backend/utils/db.py:125`, and `apps/spc/backend/utils/db.py:197`.
- Envmon has read/write classification and single-cache invalidation: `apps/envmon/backend/utils/db.py:64` and `apps/envmon/backend/utils/db.py:113`.
- Trace2 has a single cache but no write detection or invalidation: `apps/trace2/backend/utils/db.py:57`.
- Shared core has a simpler async cache: `libs/shared-db/src/shared_db/core.py:122`.

Recommended design: `shared_db` exposes a configurable `SqlRuntime` object:

```python
runtime = SqlRuntime(
    executor_env_var="SQL_EXECUTOR",
    cache_policy=CachePolicy.single(maxsize=100, ttl=300),
    audit_hook=None,
)
```

SPC can keep a tiered policy and audit hook. Envmon and trace2 can use the single policy. App-local `backend/utils/db.py` files become compatibility re-export shims plus app-specific helpers only.

### 4. Move Data Freshness Into Shared DB

`get_data_freshness` and `attach_data_freshness` are repeated in all app-local DB wrappers, with small differences in caching and failure behavior. Compare:

- `apps/spc/backend/utils/db.py:255` and `apps/spc/backend/utils/db.py:365`
- `apps/envmon/backend/utils/db.py:146` and `apps/envmon/backend/utils/db.py:219`
- `apps/trace2/backend/utils/db.py:77` and `apps/trace2/backend/utils/db.py:140`

Recommended design: centralize the core freshness query and response shape in `shared_db`. Let each app pass `alert_subject`, `audit_hook`, and `failure_mode` options. That keeps SPC's richer audit behavior without copying the SQL query and error boilerplate.

### 5. Standardize Audit Helpers and Naming

Audit helper names currently leak SPC concepts into envmon and trace2:

- `insert_spc_audit_event` exists in envmon at `apps/envmon/backend/utils/db.py:190`.
- `insert_spc_exclusion_snapshot` exists in envmon at `apps/envmon/backend/utils/db.py:255`.
- The same SPC-named helpers exist in trace2 at `apps/trace2/backend/utils/db.py:111` and `apps/trace2/backend/utils/db.py:190`.

If these tables are truly shared platform audit tables, rename the shared API to domain-neutral names such as `insert_audit_event` and `insert_exclusion_snapshot`. If they are SPC-only tables, remove the unused helpers from envmon and trace2.

### 6. Extract Trace Backend Into Shared Module

SPC and trace2 share trace schemas and the first four trace endpoints:

- SPC schemas: `apps/spc/backend/schemas/trace_schemas.py:16`
- Trace2 schemas: `apps/trace2/backend/schemas/trace_schemas.py:16`
- Trace2 adds `RecallReadinessRequest` and `BatchPageRequest` at `apps/trace2/backend/schemas/trace_schemas.py:64`.
- SPC trace router: `apps/spc/backend/routers/trace.py:26`
- Trace2 trace router: `apps/trace2/backend/routers/trace.py:37`
- Trace2 batch page router helper: `apps/trace2/backend/routers/trace.py:190` and `apps/trace2/backend/routers/trace.py:244`

Recommended design:

- Create `libs/shared-trace` or `libs/shared-db/src/shared_db/trace` depending on preferred package granularity.
- Move common request models and validators.
- Move common DAL functions used by both apps.
- Expose a router builder:

```python
router = build_trace_router(features={"core", "recall", "batch_pages"})
```

SPC can opt into `core`; trace2 can opt into `core`, `recall`, and `batch_pages`. That avoids forcing SPC to carry trace2-only routes while keeping the shared implementation in one place.

### 7. Keep SPC Statistical Logic Local For Now

SPC's `utils/msa.py`, `utils/multivariate.py`, `utils/statistical_utils.py`, SPC DALs, locked limits, exclusions, and export routes are domain-specific and test-heavy. They can be moved later if another app needs them, but there is no immediate consolidation pressure.

Recommended boundary: keep them in `apps/spc/backend` until a second app imports the behavior. Promote only shared primitives now, not SPC-specific analytical features.

### 8. Standardize Backend Dependencies

The root workspace is already set up correctly in `pyproject.toml:1`. App dependency declarations still drift:

- SPC pins `databricks-sql-connector>=4.0` at `apps/spc/backend/pyproject.toml:15`.
- Envmon pins `fastapi>=0.111`, `slowapi`, and `databricks-sdk` directly at `apps/envmon/backend/pyproject.toml:6`.
- Trace2 lacks the connector in its own package even though `shared-db` includes it at `libs/shared-db/pyproject.toml:8`.
- `requirements.txt` files still exist under app roots and backend roots, but package metadata is now the canonical uv workspace source.

Recommended design:

- Put platform dependencies needed by shared code in shared packages.
- Keep app-only dependencies in app packages.
- Remove `slowapi` from app dependencies if the in-house limiter remains the standard.
- Decide whether connector version `>=4.0` is required globally; if yes, lift it to `libs/shared-db/pyproject.toml`.
- Treat app `requirements.txt` files as generated/legacy or delete them after deploy tooling is fully uv-based.

### 9. Bring Test Coverage To All Backends

Only SPC currently has backend test files. The quick inventory found 47 files under `apps/spc/backend/tests` and none under envmon or trace2.

Recommended minimum tests before consolidating shared modules:

- Shared app factory tests for exception handling, SPA fallback, health/ready, and optional debug endpoint.
- Shared SQL runtime tests for read caching, write invalidation, connector fallback, and error mapping.
- Trace2 regression test proving write statements are not cached.
- Shared trace router tests for core endpoints and feature-gated batch pages.
- Envmon config tests for table quoting, inspection type parsing, and invalid env values.

### 10. Standardize Deployment Scripts

SPC, envmon, and trace2 all do the same broad deploy workflow, but use different scripts:

- SPC Makefile contains migration orchestration and app config rendering.
- Envmon delegates to `deploy.sh`.
- Trace2 has a post-deploy scope reapply script.

Backend impact: deploy behavior affects OAuth token passthrough, readiness tokens, app env vars, migrations, and generated app config.

Recommended design: create one shared deploy/render script that accepts app metadata and migration lists. Keep app-level Makefiles as thin wrappers.

## Prioritized Implementation Plan

### Phase 1: Safe Platform Consolidation

1. Move `SameOriginMiddleware` to a shared package and enable it for envmon and trace2.
2. Add envmon and trace2 backend smoke tests for health, readiness failure modes, static fallback, and one authenticated route each.
3. Create a shared FastAPI app factory/helper and migrate the three `main.py` files to it.
4. Normalize readiness response shapes and debug endpoint availability.

Why first: this removes visible duplication, improves security consistency, and should be easy to test without touching domain SQL.

### Phase 2: SQL Runtime Standardization

1. Add a configurable SQL runtime to `shared_db`.
2. Port envmon to it first because its wrapper is simpler but has write invalidation.
3. Port trace2 and fix write-statement caching at the same time.
4. Port SPC last, preserving tiered caches and query audit behavior.
5. Keep app-local `backend/utils/db.py` files as compatibility shims until imports can be cleaned gradually.

Why second: this is the highest backend risk area and should be done with focused tests.

### Phase 3: Trace Backend Consolidation

1. Move common trace request models and validators to a shared trace module.
2. Move common trace DAL functions.
3. Build a feature-gated trace router.
4. Migrate SPC to `core` features and trace2 to `core + recall + batch_pages`.
5. Add parity tests around route registration and response behavior.

Why third: the trace backend is visibly duplicated, but the DAL is large. It should follow the SQL runtime consolidation so the shared module does not inherit three SQL wrapper styles.

### Phase 4: Tooling And Deploy Standardization

1. Remove or generate legacy requirements files.
2. Lift shared dependency versions to shared packages.
3. Add a shared app config renderer.
4. Unify Databricks deployment wrapper behavior for app scopes, migrations, and frontend build artifacts.

## Risks To Watch

- Trace2 write caching is a behavioral risk today if mutating helpers are used through `run_sql_async`.
- Moving SPC SQL wrappers too early could break query audit, tiered cache behavior, and schema readiness.
- Envmon configuration includes duplicated inspection-type parsing; clean this before using it as a shared pattern.
- `shared-auth` is not yet a real auth package. Do not build new auth abstractions on it until token validation requirements are clear.
- Consolidating trace DAL SQL without tests could silently change large query payloads.

## Recommended Immediate Backlog

1. Add `libs/shared-api` with app factory, exception handler, static SPA serving, readiness/debug helpers, and shared same-origin middleware.
2. Add envmon/trace2 backend smoke tests.
3. Fix trace2 `run_sql_async` to classify writes and invalidate/skip cache for non-read statements.
4. Deduplicate `envmon` inspection type config.
5. Draft `shared_db.SqlRuntime` and migrate envmon first.
6. Extract shared trace schemas and the core trace router once SQL runtime is stable.

