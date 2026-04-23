# Consolidation Execution Plan

This plan turns the repo-wide consolidation opportunities into an execution
sequence grouped by value and effort. It assumes the branch remains
`codex-magic` and that changes should land in small, testable slices.

For every execution slice, update
`REPO_CONSOLIDATION_OPPORTUNITY_MAP.md` in the same change. The map should show
the latest status, new evidence discovered during implementation, and the next
action for the affected opportunity.

## Planning Assumptions

- Trace2 is the deployment baseline. Its Makefile explicitly says to use
  `make deploy` as the full path, covering auth, frontend build, app config
  render, Databricks bundle deploy, app snapshot, and `user_api_scopes` repair
  in `apps/trace2/Makefile:3`.
- Trace2 also has a shell fallback for hosts without make in
  `apps/trace2/scripts/deploy.sh:4`, with the same five-step flow implemented
  at `apps/trace2/scripts/deploy.sh:42`.
- Envmon and SPC deployment should be moved toward that end-to-end flow. The
  target is not "break the Makefile into more individual commands"; the target
  is one reliable deploy entry point plus smaller reusable functions behind it.
- Backend consolidation should start with infrastructure behavior before domain
  logic: API runtime, SQL runtime, then shared trace.
- Frontend consolidation should start with transport/build standards before UI
  design-system convergence.
- Scanner/reporting work should run early because it gives each later slice a
  measurable baseline.

## Value and Effort Matrix

| Group | Workstream | Value | Effort | Priority | Why |
| --- | --- | --- | --- | --- | --- |
| A | Consolidation scanner suite | High | Low | 1 | Creates objective route, SQL, dependency, deploy, and test drift reports. |
| A | Trace2-led deploy standardization | High | Medium | 2 | Deployment reliability is already proven in trace2 and fixes a real operating pain. |
| A | Shared API runtime completion | High | Medium | 3 | Removes repeated FastAPI setup and hardens same-origin/readiness behavior. |
| A | Shared DB SQL runtime | High | Medium | 4 | Removes duplicated cache, token, freshness, and Databricks execution logic. |
| B | Remove/generalize SPC-named helpers in envmon/trace2 | Medium | Low | 5 | Low-risk cleanup with high clarity value before deeper extraction. |
| B | Frontend API client standardization | Medium | Medium | 6 | Unifies error handling and request helpers without touching UI design. |
| B | Shared trace schemas/tree/conformance tests | High | High | 7 | Valuable but should be protected by scanner output and tests first. |
| B | Frontend Vite/Nx/package drift cleanup | Medium | Medium | 8 | Reduces build drift after API/deploy baselines are stable. |
| C | Data contract catalog | Medium | Medium | 9 | Useful for trace and freshness work, but benefits from SQL scanner output first. |
| C | Migration orchestration | Medium | Medium | 10 | Should follow deploy standardization and data catalog decisions. |
| C | Carbon shell primitives | Medium | High | 11 | Useful for envmon/SPC but should not block backend/deploy consolidation. |
| D | SPC statistical utility extraction | Low | High | 12 | Too domain-specific to extract before core shared infrastructure is stable. |
| D | Full shared auth domain | Low | High | 13 | Premature until roles, claims, and cross-app authorization rules are clearer. |

## Phase 0: Baseline and Guardrails

Value: high. Effort: low.

Goal: make consolidation decisions measurable before moving more code.

Deliverables:

- `scripts/consolidation_audit.py`
- `reports/consolidation/route-map.md`
- `reports/consolidation/sql-table-map.md`
- `reports/consolidation/dependency-drift.md`
- `reports/consolidation/deploy-drift.md`
- `reports/consolidation/test-matrix.md`

Tasks:

1. Generate backend route maps for all apps, including method, path, handler,
   module, rate limit, and declared freshness sources.
2. Extract SQL table/view references from Python, SQL, Makefile, and shell
   files.
3. Compare frontend `package.json`, backend `pyproject.toml`, and root lock
   dependencies.
4. Compare deployment entry points, app template syntax, Databricks CLI pins,
   scope handling, and post-deploy hooks.
5. Count backend/frontend tests by app and flag missing conformance tests.

Acceptance criteria:

- Scanner runs locally with no network or Databricks dependency.
- Reports are deterministic and committed.
- Reports identify the current trace2 deploy flow as the reference baseline.

Suggested validation:

```bash
python scripts/consolidation_audit.py
git diff -- reports/consolidation
```

## Phase 1: Deployment Standardization Using Trace2 as Baseline

Value: high. Effort: medium.

Goal: make every app deploy through one reliable, automated entry point modeled
on trace2.

Why trace2 leads:

- `apps/trace2/Makefile:3` documents that `make deploy` is the intended entry
  point.
- `apps/trace2/Makefile:43` wires deploy dependencies in order:
  `check-env`, `build`, `render-app-config`, bundle deploy, post-deploy.
- `apps/trace2/scripts/deploy.sh:42` implements the same flow as a portable
  script.
- `apps/trace2/scripts/render-app-yaml.sh:27` handles MSYS path conversion,
  which is a practical portability fix worth preserving.

Deliverables:

- `scripts/deploy_app.py` or `scripts/deploy_app.sh`
- `scripts/render_app_config.py` or a shared renderer module
- `apps/<app>/deploy.toml`
- Updated `apps/envmon/Makefile`
- Updated `apps/spc/Makefile`
- Trace2 kept compatible with `make deploy` and `scripts/deploy.sh`

Tasks:

1. Capture trace2's deployment behavior as the canonical sequence:
   authenticate, build frontend, render app config, bundle deploy, trigger app
   snapshot/post-deploy, repair scopes.
2. Create a declarative per-app deploy manifest with app name, bundle name,
   profile default, app template, output file, required environment variables,
   frontend build command, and post-deploy hook.
3. Move trace2 onto the shared deploy wrapper first without changing behavior.
4. Move envmon onto the shared wrapper.
5. Move SPC onto the shared wrapper last, preserving its richer migration
   commands as explicit hooks.
6. Replace individual command runbooks with `make deploy` plus documented
   subcommands for debugging only.

Acceptance criteria:

- `make deploy` remains the standard command for all three apps.
- Trace2 deployment behavior is unchanged.
- Envmon and SPC can use the same sequence without manually executing broken
  Makefile fragments.
- App-specific hooks remain visible and testable.
- The deploy drift report shows no missing auth/build/render/deploy/post-deploy
  stage for any app.

Suggested validation:

```bash
make -C apps/trace2 render-app-config
make -C apps/envmon render-app-config
make -C apps/spc render-app-config
```

Full deploy validation should be run only in the intended Databricks profile.

## Phase 2: Shared API Runtime

Value: high. Effort: medium.

Goal: finish the shared FastAPI foundation started in `libs/shared-api`.

Deliverables:

- `libs/shared-api/src/shared_api/app_factory.py`
- `libs/shared-api/src/shared_api/health.py`
- `libs/shared-api/src/shared_api/errors.py`
- App adapters for envmon, trace2, and SPC.

Tasks:

1. Add a shared app config model for title, docs mode, frontend mount path,
   same-origin settings, readiness checks, and static fallback.
2. Move shared health/readiness response helpers into `shared-api`.
3. Migrate envmon first, then trace2, then SPC.
4. Keep routers app-owned and avoid forcing a framework over app startup.
5. Add conformance tests for health, readiness, static mount, and same-origin
   middleware.

Acceptance criteria:

- Existing backend tests pass.
- Shared API tests cover app factory behavior without needing Databricks.
- Each app has thinner `main.py` setup.

Suggested validation:

```bash
uv run --package shared-api pytest
PYTHONPATH=. uv run --package envmon-backend pytest backend/tests
PYTHONPATH=. uv run --package trace2-backend pytest backend/tests
PYTHONPATH=apps/spc uv run --package spc-backend pytest apps/spc/backend/tests/test_same_origin_middleware.py apps/spc/backend/tests/test_main.py --no-cov
```

## Phase 3: Shared DB SQL Runtime

Value: high. Effort: medium.

Goal: unify Databricks SQL execution and reduce runtime drift.

Deliverables:

- `libs/shared-db/src/shared_db/runtime.py`
- `libs/shared-db/src/shared_db/freshness.py`
- `libs/shared-db/src/shared_db/errors.py`
- `libs/shared-db/src/shared_db/tables.py`
- Envmon and trace2 adapters using shared runtime.

Tasks:

1. Move statement execution, SQL parameter helpers, read/write detection, cache
   behavior, and cache invalidation into `shared-db`.
2. Move freshness lookup into a shared helper.
3. Make audit insertion an optional app-owned sink, not a hard-coded SPC table
   reference.
4. Remove or generalize `insert_spc_audit_event` in envmon and trace2.
5. Remove trace2's SPC exclusion snapshot helper unless a trace2 route actually
   uses it.
6. Leave SPC migration until its DAL/exclusion tests are strong enough.

Acceptance criteria:

- Non-read SQL statements are never cached.
- Writes invalidate relevant cache state.
- Envmon and trace2 DB tests cover success and error paths.
- SPC-named tables are not referenced from envmon/trace2 unless explicitly
  configured by an app manifest.

Suggested validation:

```bash
uv run --package shared-db pytest
PYTHONPATH=. uv run --package envmon-backend pytest backend/tests
PYTHONPATH=. uv run --package trace2-backend pytest backend/tests
```

## Phase 4: Frontend Transport and Build Standardization

Value: medium. Effort: medium.

Goal: remove frontend drift that does not affect product design.

Deliverables:

- `libs/shared-frontend-api/src/client.ts`
- `libs/shared-frontend-api/src/errors.ts`
- `libs/shared-frontend-api/src/queryClient.ts`
- Shared Vite config helper or documented Vite defaults.
- Dependency drift fixes for React typings, TypeScript, Vite, and test tooling.

Tasks:

1. Extract `ApiError` and JSON helpers.
2. Adopt shared query client defaults in envmon and SPC.
3. Keep trace2 response mapping local until trace backend contracts stabilize.
4. Normalize Vite aliases, proxy defaults, sourcemap policy, and build output.
5. Align dependency versions where there is no app-specific reason for drift.

Acceptance criteria:

- Envmon and SPC frontend API tests use the shared helpers.
- Trace2 can import shared transport helpers without adopting React Query yet.
- Frontend builds still pass app-by-app.

Suggested validation:

```bash
npm test --prefix apps/spc/frontend
npm run build --prefix apps/envmon/frontend
npm run build --prefix apps/spc/frontend
npm run build --prefix apps/trace2/frontend
```

## Phase 5: Shared Trace Contract

Value: high. Effort: high.

Goal: extract common traceability behavior only after route maps and tests make
the boundary clear.

Deliverables:

- `libs/shared-trace/src/shared_trace/schemas.py`
- `libs/shared-trace/src/shared_trace/tree.py`
- `libs/shared-trace/src/shared_trace/freshness_sources.py`
- Shared route conformance tests.

Tasks:

1. Extract request schemas shared by SPC and trace2.
2. Extract tree-building behavior.
3. Add conformance tests for `/trace`, `/summary`, `/batch-details`, and
   `/impact` across SPC and trace2.
4. Move core DAL SQL only after the tests pass against both apps.
5. Keep trace2-only recall/CoA/mass-balance/supplier-risk pages app-owned.

Acceptance criteria:

- Shared trace tests validate response shape compatibility.
- SPC and trace2 retain their current endpoint paths.
- No SPC charting, Genie, or exclusion logic moves into shared trace.

Suggested validation:

```bash
uv run --package shared-trace pytest
PYTHONPATH=. uv run --package trace2-backend pytest backend/tests
PYTHONPATH=apps/spc uv run --package spc-backend pytest apps/spc/backend/tests --no-cov
```

## Phase 6: Data Catalog and Migration Orchestration

Value: medium. Effort: medium.

Goal: make Databricks view/table dependencies explicit and use them in deploy
and freshness behavior.

Deliverables:

- `config/data_catalog.yaml`
- `config/migrations.yaml`
- Generated freshness source lists or route docs.
- Shared migration runner integrated into the deploy wrapper.

Tasks:

1. Promote SQL scanner output into a maintained data catalog.
2. Record logical dataset name, physical table/view, owning app, consuming apps,
   freshness support, and migration source.
3. Define migration manifests by app.
4. Add deploy-time validation that required datasets/migrations are declared.
5. Gate destructive migrations explicitly.

Acceptance criteria:

- Freshness source lists can be generated or checked from the catalog.
- Deploy drift report includes migration manifest coverage.
- App deploys do not hide ad hoc migration behavior inside large Makefiles.

## Phase 7: UI Shell Consolidation

Value: medium. Effort: high.

Goal: share UI shell primitives where the design systems already match.

Deliverables:

- `libs/shared-ui`
- Shared Carbon shell primitives for envmon and SPC.
- App-owned navigation/filter/content composition.

Tasks:

1. Extract only Carbon shell pieces shared by envmon and SPC.
2. Keep app-specific filters, sidebars, panels, and pages local.
3. Leave trace2 out until there is a design decision to move it to Carbon.
4. Add simple app mount tests around shell usage.

Acceptance criteria:

- Envmon and SPC share shell primitives without losing app-specific behavior.
- Trace2 UI remains stable.
- No backend/deploy work is blocked by UI consolidation.

## Work Not Scheduled Yet

These items are intentionally deferred:

- SPC statistical utility extraction.
- Full shared auth domain.
- Trace2 Carbon redesign.
- Deep SQL DAL extraction before route/data conformance tests exist.

## Recommended Sprint Order

Sprint 1:

- Phase 0 scanner suite.
- Start Phase 1 by capturing trace2 deploy as the shared deploy contract.

Sprint 2:

- Finish Phase 1 for trace2 and envmon.
- Start Phase 2 shared API runtime with envmon.

Sprint 3:

- Finish Phase 2 across trace2 and SPC.
- Start Phase 3 shared DB runtime for envmon and trace2.

Sprint 4:

- Finish Phase 3.
- Start Phase 4 frontend API/client standardization.

Sprint 5:

- Add shared trace schemas/tree/conformance tests.
- Decide whether to move core trace DAL SQL.

Sprint 6:

- Data catalog and migration orchestration.
- Begin UI shell consolidation if deployment/backend drift is stable.

## Immediate Next Slice

Phase 0 through Phase 4 are complete. Phase 5 has started with shared trace
request schemas, tree building, freshness-source contracts, and app-level
conformance tests. The next Sprint 5 decision is whether to move core trace DAL
SQL after SPC and trace2 pass those shared route contracts.
