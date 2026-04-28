# Repo Consolidation Contract

This repository uses Nx as the monorepo command contract, `uv` as the Python
workspace runner, npm workspaces for frontend packages, and Databricks Apps as
the deploy target.

## Command Contract

Top-level commands are the source of truth for repo health:

- `npm test` runs every project `test` target and must terminate without watch mode.
- `npm run typecheck` runs static type gates for projects that expose them.
- `npm run check:repo` validates target shape and catches watch-mode test drift.
- `npm run check:app-configs` verifies committed `app.yaml` files match rendered defaults.
- `npm run render:app-configs` renders app configs from `deploy.toml` and templates.

Frontend Nx `test` targets must call `npm run test:ci` in the app frontend
package. Package-level `npm test` may remain developer-watch mode, but Nx must
never use it for repo gates.

Python Nx `test` targets must run through the workspace environment:

```sh
PYTHONPATH=<app-and-lib-srcs> uv run --no-sync --package <package> python -m pytest <tests>
```

## Ownership Boundaries

Shared libraries own reusable infrastructure and cross-app contracts:

- `libs/shared-db`: SQL execution, cache policy primitives, rate limiting, error mapping.
- `libs/shared-api`: FastAPI middleware, response/error helpers, common API utilities.
- `libs/shared-auth`: shared auth/security behavior.
- `libs/shared-trace`: traceability domain primitives shared by trace apps.
- `libs/shared-frontend-api`: browser request/query primitives.

Applications own domain policy and product behavior:

- route composition
- DAL query shape
- app-specific SQL cache tier choices
- app-specific audit hooks
- UI workflows and domain presentation

Shared libraries must not import from `apps/`. Applications must not import from
other applications. When behavior is useful across apps, move it into `libs/`
first and have apps configure it.

## SQL Runtime Model

Apps should use `shared_db.runtime.SqlRuntimeConfig` to build a runtime from:

- a `run_sql` callable
- a `CachePolicy`
- optional audit hook
- optional background audit dispatch
- cache invalidation settings at call sites

`SqlRuntime` owns execution, async dispatch, read caching, write invalidation,
duration capture, audit hook invocation, and SQL error mapping. Apps may choose
cache tiers and audit payload behavior, but they should not duplicate SQL
execution loops or cache storage logic.

## App Config Model

Each app keeps deploy settings in `deploy.toml` and renders `app.yaml` from
`app.template.yaml`. The shared deploy wrapper in `scripts/deploy_app.py` is
the canonical render/deploy path.

Committed generated configs are allowed only when they match the default render.
`npm run check:app-configs` enforces this. To refresh generated configs, run:

```sh
npm run render:app-configs
```

## Current Status (April 2026)

The primary consolidation phase is complete. All apps (envmon, SPC, trace2, warehouse360, processorderhistory) are part of the monorepo and share:
- Deployment infrastructure (`scripts/deploy_app.py`)
- SQL Runtime and Data Freshness checks (`libs/shared-db`)
- Core Traceability logic (`libs/shared-trace`)
- Frontend API and i18n utilities (`libs/shared-frontend-*`)
- Strict i18n validation (13 languages enforced)

### Next Steps
1. **Data Contract Catalog**: Promote `reports/consolidation/sql-table-map.md` into a maintained source-of-truth.
2. **Real UAT Deploys**: Execute the first live deploys through the shared wrapper for all apps.
3. **Migration Manifests**: Standardize the SQL migration entries in `deploy.toml`.

## Documentation Cleanup (April 2026)

To maintain a high-signal repository, stale plans and temporary consolidation tracking files have been removed:
- Root-level consolidation plans (`BACKEND_CONSOLIDATION_*.md`, `CONSOLIDATION_EXECUTION_PLAN.md`, `REPO_CONSOLIDATION_OPPORTUNITY_MAP.md`) were merged into this document or `TODO.md`.
- Legacy SPC migration plans and quality reviews from early 2026 were deleted.
- Finished spec-level plans in `apps/spc/specs/` were deleted.

## Adding Or Changing A Project

When adding an app or shared package:

1. Add a `project.json` with consistent Nx targets.
2. Add Python packages to the uv workspace or frontend packages to npm workspaces.
3. Use shared runtime/client primitives before adding app-local infrastructure.
4. Add tests at the shared layer for reusable behavior and app tests for policy.
5. Run `npm run check:repo`, `npm test`, and `npm run typecheck`.
