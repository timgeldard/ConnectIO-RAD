# Setup — local development

## Prerequisites

- **Node** 20.x (matches the rest of the monorepo)
- **Python** 3.11+
- **uv** (`pip install uv` if missing)
- **Databricks CLI** ≥ 0.220 (`brew install databricks/tap/databricks` or equivalent)

## First-time install

From the repo root:

```bash
# Install Node workspaces (links @connectio/shared-frontend-i18n)
npm install

# Sync Python deps (this app + shared libs)
uv sync --package processorderhistory-backend
```

## Run

```bash
# From apps/processorderhistory
make dev
```

That starts:

- `vite` on `http://localhost:5173`
- `uvicorn backend.main:app --reload` on `http://localhost:8000`

Vite proxies `/api/*` to uvicorn so the frontend can call backend endpoints
without CORS plumbing.

## Build

```bash
cd apps/processorderhistory/frontend
npm run typecheck   # tsc --noEmit
npm run build       # tsc -b && vite build  → dist/
npm run test:ci     # vitest run --coverage
```

Or via Nx:

```bash
nx run processorderhistory-frontend:build
nx run processorderhistory-frontend:test
```

## Deploy

```bash
make deploy                     # default profile uat
make deploy PROFILE=prod
```

`make deploy` invokes `scripts/deploy_app.py` which:

1. Auths against the Databricks workspace.
2. Runs `python3 scripts/build.py` → copies `libs/shared-{api,db}` into the
   app root and runs `npm run build`.
3. Renders `app.yaml` from `app.template.yaml`.
4. Runs `databricks bundle deploy`.
5. Snapshots a fresh app deployment.

After the deploy, configure SQL OAuth scopes via the App Settings UI (not in
`databricks.yml`) — the `user_api_scopes: ["sql"]` declaration in the bundle
file is what the wrapper preserves across re-deploys.
