# ConnectIO-RAD Copilot Instructions

## Start here

- Read these files before changing data access or domain logic, in this order:
  1. `ai-context/rules/agent_working_rules.md`
  2. `ai-context/semantic-model/entities.yaml`
  3. `ai-context/semantic-model/joins.yaml`
  4. `ai-context/glossary/business_terms.md`
  5. `ai-context/examples/canonical_sql.sql`
- For frontend work, also read `ai-context/rules/frontend_rules.md`.
- For backend work, also read `ai-context/rules/backend_rules.md`.
- Never work directly on `main`/`master`; use a feature or fix branch.

## Build, test, and lint

### Repo-wide commands

```bash
npm install
uv sync

npm run check:repo
npm run check:i18n
npm run check:app-configs

npm run lint
npm run test
npm run build
npm run typecheck

uv run pytest scripts/tests/test_ddd_architecture_guardrails.py
```

### Targeted Nx commands

Use Nx for app-level work:

```bash
npx nx run <app>-frontend:dev
npx nx run <app>-frontend:build
npx nx run <app>-frontend:lint
npx nx run <app>-frontend:test
npx nx run <app>-frontend:test:coverage

npx nx run <app>-backend:sync
npx nx run <app>-backend:serve
npx nx run <app>-backend:lint
npx nx run <app>-backend:test
```

Examples:

```bash
npx nx run envmon-frontend:test
npx nx run trace2-backend:test
```

### Running a single test

Backend:

```bash
uv run --no-sync --package envmon-backend python -m pytest apps/envmon/backend/tests/test_some_module.py
uv run --no-sync --package envmon-backend python -m pytest apps/envmon/backend/tests/test_some_module.py -k test_case_name
```

Frontend:

```bash
cd apps/envmon/frontend
npm test -- --run src/path/to/some.test.tsx
npm test -- --run -t "test name"
```

### CI command pattern

CI uses affected-project execution rather than always running the whole repo:

```bash
npx nx affected -t sync --base=<base> --head=<head> --parallel=4
npx nx affected -t lint --base=<base> --head=<head> --parallel=4
npx nx affected -t typecheck --base=<base> --head=<head> --parallel=4
npx nx affected -t test --base=<base> --head=<head> --parallel=4
npx nx affected -t build --base=<base> --head=<head> --parallel=4
```

## High-level architecture

- This is an Nx monorepo with **npm workspaces** for React frontends and a **uv workspace** for Python backends and shared libraries.
- The repo contains multiple Databricks Apps: `platform`, `connectedquality`, `envmon`, `spc`, `trace2`, `warehouse360`, and `processorderhistory`.
- Most apps follow the same split: `frontend/` is a React 18 + Vite SPA, `backend/` is a FastAPI service, and the backend serves the built frontend plus `/api/health` and `/api/ready`.
- Backend code is organized around pragmatic DDD / modular monolith boundaries: app-specific business logic belongs in bounded contexts under `domain/` and `application/`, SQL lives in `dal/`, and HTTP transport stays in routers.
- Shared libraries own cross-app infrastructure:
  - `libs/shared-api`: FastAPI app factory, middleware, SPA route registration, health/readiness helpers
  - `libs/shared-auth`: shared auth and Databricks/OIDC token handling
  - `libs/shared-db`: SQL runtime, caching, data freshness, async execution, SQL error mapping
  - `libs/shared-trace`: traceability domain primitives shared across trace-focused apps
  - `libs/shared-frontend-api`: browser request/query primitives
  - `libs/shared-frontend-i18n`: language provider and i18n helpers
  - `libs/shared-ui`: Kerry design-system components and tokens
- Applications own product behavior and domain policy. Shared libraries must not import from `apps/`, and apps must not import from other apps.
- `platform` is the shell and navigation entry point across apps. `connectedquality` is the cross-domain quality aggregator.
- Deploy config is generated from each app’s `deploy.toml` and `app.template.yaml`; the canonical render/deploy flow is the shared `scripts/deploy_app.py` path, with CI using `nx affected -t deploy`.
- The data contract is file-driven: `ai-context/semantic-model/*` defines approved entities, joins, and SQL patterns. Treat those files as the source of truth even if live Databricks access exists.

## Key conventions

- Query only approved Unity Catalog **gold-layer** views. Do not invent tables, query bronze/silver data, or invent join paths outside `ai-context/semantic-model`.
- In backend SQL, always use `tbl("table_name")` for table references and named parameters like `:batch_id`; do not hardcode catalog/schema names or interpolate user input into SQL.
- Reuse the canonical SQL patterns in `ai-context/examples/canonical_sql.sql` for recursive lineage, mass balance, batch status, and related traceability flows.
- Databricks SQL Statement API results arrive as strings. Parse them once in the backend mapper or frontend data/client layer, not ad hoc inside UI components.
- Auth is user-token passthrough. Prefer `x-forwarded-access-token`; do not replace this with app-side service-account filtering.
- Frontend styling should use Kerry design tokens and `@connectio/shared-ui`. Do not introduce `@carbon/*`; Carbon is deprecated here.
- Frontend text must live in `src/i18n/resources.json` with full coverage for all 16 required languages: `en`, `de`, `fr`, `es`, `ja`, `pt`, `id`, `ms`, `ga`, `pl`, `nl`, `uk`, `da`, `vi`, `zh-Hans`, `zh-Hant`.
- Repo contract matters: frontend Nx test targets are expected to be non-watch (`npm test -- --run`), while coverage runs through `npm run test:ci`.
- Keep generated `app.yaml` files aligned with `deploy.toml` and `app.template.yaml`; use `npm run render:app-configs` / `npm run check:app-configs` instead of hand-editing generated deploy output.
- `processorderhistory` is not fully wired like the other apps yet: its frontend is still prototype-derived, backed by `frontend/src/data/mock.ts`, and many TS/TSX files intentionally use `// @ts-nocheck`. Do not assume it already follows the stricter typed/API-backed patterns used elsewhere.
