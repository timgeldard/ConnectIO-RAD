# ConnectIO-RAD Repository Map

## 1. Applications under `/apps` and their purpose

*   **`platform`**: Unified entry point and navigation shell for all applications in the ConnectIO-RAD suite. Provides cross-app context and badge aggregation.
*   **`warehouse360`**: Warehouse Operations Cockpit for inbound, outbound, inventory, staging, and IM/WM reconciliation workflows.
*   **`spc`**: Statistical Process Control module for real-time charting, advanced capability calculations, and root-cause suggestions.
*   **`trace2`**: Batch Traceability application mapping lineage across Unity Catalog gold views (top-down, bottom-up, mass balance).
*   **`envmon`**: Environmental Monitoring visualisation app using spatial interactive heatmaps for microbial swab analytics.
*   **`processorderhistory`**: Plant-floor view of process order execution, manufacturing analytics, and production planning.
*   **`connectedquality`**: Gateway app for cross-domain quality monitoring, alerting, and analysis.
*   **`template`**: New Module Reference / Demo application showing the standard DDD bounded context setup.

## 2. Application Details

### `platform`
*   **Frontend framework**: React / TypeScript / Vite
*   **Backend framework**: FastAPI
*   **Main entry points**: Unified shell UI; backend proxies (`backend/main.py`).
*   **Deployment method**: Uses `scripts/build.py` to copy backends, then `deploy_app.py` or Databricks bundle deploy.
*   **Local dev command**: `npx nx run platform-frontend:dev`
*   **Test command**: `npm run test` (frontend), `uv run pytest` (backend)
*   **Data access approach**: Frontend proxies to other backend apps; acts as a shell.
*   **Environment variables**: `AUTH_ALLOW_UNVERIFIED_JWT`, `APP_TRUST_X_FORWARDED_HOST`, `AUTH_JWKS_URL`
*   **Bounded contexts/domains**: Cross-App Context, Badge Aggregation, Genie Assistant.

### `warehouse360`
*   **Frontend framework**: React / TypeScript / Vite
*   **Backend framework**: FastAPI
*   **Main entry points**: `backend/main.py`, `frontend/src/App.tsx`
*   **Deployment method**: `make deploy` (uses `scripts/deploy_app.py`)
*   **Local dev command**: `make dev`
*   **Test command**: `make test`
*   **Data access approach**: PyPika SQL builders against Unity Catalog (`WH360_SCHEMA`).
*   **Environment variables**: `WH360_SCHEMA` (defaults to `wh360`)
*   **Bounded contexts/domains**: `inventory_management` (Anemic domain model).

### `spc`
*   **Frontend framework**: React / TypeScript / Vite
*   **Backend framework**: FastAPI
*   **Main entry points**: `backend/main.py`, `frontend/src/SPCPage`
*   **Deployment method**: `python3 ../../scripts/deploy_app.py --app-dir . --action deploy --profile uat`
*   **Local dev command**: `uv run ... uvicorn spc_backend.main:app` and `npm run dev`
*   **Test command**: `make test`, `make test-stat`, `make test-dal`
*   **Data access approach**: PyPika SQL Builders delegating to `shared-db`, reading from `TRACE_CATALOG.TRACE_SCHEMA`.
*   **Environment variables**: `TRACE_CATALOG`, `TRACE_SCHEMA`, `WAREHOUSE_ID`
*   **Bounded contexts/domains**: `chart_config` (Exclusion, LockedLimits), `process_control` (MSA, Control Charts, Capability).

### `trace2`
*   **Frontend framework**: React / TypeScript / Vite
*   **Backend framework**: FastAPI
*   **Main entry points**: `backend/main.py`
*   **Deployment method**: `bash scripts/deploy.sh`
*   **Local dev command**: `bash scripts/dev.sh`
*   **Test command**: `uv run pytest`, `npm test`
*   **Data access approach**: Recursive SQL queries against Unity Catalog `connected_plant_uat.gold` via `shared-db`.
*   **Environment variables**: `TRACE_CATALOG`, `TRACE_SCHEMA`
*   **Bounded contexts/domains**: `batch_trace`, `lineage_analysis`, `quality_record`.

### `envmon`
*   **Frontend framework**: React / TypeScript / Vite
*   **Backend framework**: FastAPI
*   **Main entry points**: `backend/main.py`, `frontend/src/App.tsx`
*   **Deployment method**: `make deploy PROFILE=uat`
*   **Local dev command**: `make dev`
*   **Test command**: `make test` / `uv run pytest`
*   **Data access approach**: Databricks SQL SDK against `TRACE_CATALOG`.`TRACE_SCHEMA` Unity Catalog views.
*   **Environment variables**: `EM_PLANT_ID`, `EM_FLOOR_CONFIG`, `EM_LOT_TABLE`, `EM_RESULT_TABLE`
*   **Bounded contexts/domains**: `inspection_analysis` (Valuation, SPC, Risk, Status), `spatial_config` (Coordinate, PlantGeo).

### `processorderhistory`
*   **Frontend framework**: React / TypeScript / Vite
*   **Backend framework**: FastAPI
*   **Main entry points**: `backend/main.py`
*   **Deployment method**: `make deploy`
*   **Local dev command**: `make dev`
*   **Test command**: `uv run pytest`, `npm test`
*   **Data access approach**: PyPika queries against `csm_process_order_history` and `csm_equipment_history` schemas.
*   **Environment variables**: `POH_CATALOG`, `POH_SCHEMA`
*   **Bounded contexts/domains**: order_execution, manufacturing_analytics, production_planning, genie_assist.

### `connectedquality`
*   **Frontend framework**: React / TypeScript / Vite
*   **Backend framework**: FastAPI
*   **Main entry points**: BFF (Backend-for-Frontend) Gateway.
*   **Deployment method**: `scripts/deploy_app.py`
*   **Local dev command**: `make dev` (assumed standard)
*   **Test command**: `uv run pytest backend/tests`
*   **Data access approach**: Integrates upstream data; minimal direct SQL.
*   **Environment variables**: `databricks.yml` variables.
*   **Bounded contexts/domains**: `user_preferences` (Isolated, mostly gateway).

### `template`
*   **Frontend framework**: React / TypeScript / Vite
*   **Backend framework**: FastAPI
*   **Main entry points**: FastAPI routers (`module_template` bounded context).
*   **Deployment method**: Databricks Apps via `databricks.yml`
*   **Local dev command**: `npx nx run template-backend:serve`, `npx nx run template-frontend:dev`
*   **Test command**: `npx nx run template-backend:test`, `npx nx run template-frontend:test`
*   **Data access approach**: `module_template/dal/repository.py` (Currently demo repository rows).
*   **Environment variables**: Unknown
*   **Bounded contexts/domains**: `module_template`.

## 3. Shared Libraries and Scripts

### Shared Libraries (`libs/`)
*   **`shared-api`**: Common FastAPI middleware (CORS, rate-limiting, exception responses).
*   **`shared-auth`**: Token validation, OIDC token passthrough logic.
*   **`shared-db`**: Swappable Databricks SQL execution adapter using parameterised `run_sql_async`.
*   **`shared-ddd`**: Standard `Entity`, `AggregateRoot`, `ValueObject`, and `Repository` base classes.
*   **`shared-frontend-api`**: React Query hooks and frontend API clients.
*   **`shared-frontend-i18n`**: Global i18n translation context (16 locales).
*   **`shared-ui`**: Kerry Design System tokens and React components.
*   **`shared-trace`**: Legacy monolithic read-model engine with recursive SQL queries.
*   **`shared-manufacturing`**: Shared manufacturing domain logic.
*   **`shared-geo`**: Shared geographic logic.
*   **`shared-app-context`**: Shared frontend application context state.
*   **`shared-reporting`**: Reporting abstractions.

### Scripts (`scripts/`)
*   **`rad.py`**: ConnectIO-RAD CLI — unified developer workflow tool.
*   **`deploy_app.py`**: Centralized script to render templates, build frontends, and execute Databricks deploy.
*   **`tests/test_ddd_architecture_guardrails.py`**: Linter enforcing the frozen 4-layer DDD architecture across all backends.
*   **`validate_domain_language.py`**: Domain language linter against the domain glossary.
*   **`validate_i18n.py`**: CI gate ensuring 100% i18n translation coverage across locales.
*   **`check_wheel_versions.py`**: Ensures wheel package bumps accompany source changes.

## 4. CI/CD and Databricks Deployment Structure

*   **GitHub Actions CI Pipeline**:
    1.  **Sync & Lint**: `uv sync`, `npm run lint`, Ruff, ESLint.
    2.  **Guards**: Wheel version guard, `test_ddd_architecture_guardrails.py` (architecture guardrails).
    3.  **Typecheck**: `tsc` validation.
    4.  **Test**: `vitest`, `pytest` with a mandatory >=75% unit test coverage gate.
    5.  **Security**: `pip-audit`, `npm audit`, `gitleaks`, `CodeQL`.
    6.  **Build**: Compiles Vite static assets using Nx caching (`nx affected`).
*   **Databricks Apps Deployment**:
    *   Initiated on the `main` branch post-CI using `scripts/deploy_app.py`.
    *   Deploys as Databricks Apps using OIDC token passthrough (`x-forwarded-access-token`) directly to Databricks SQL (enforcing Unity Catalog policies).
    *   Includes a `scripts/post-deploy.sh` step to patch the fact that `databricks bundle deploy` empties `user_api_scopes` (preventing SQL passthrough) by re-applying `user_api_scopes: ["sql"]`.

## 5. Known High-Risk Areas

*   **Platform Shell Source Duplication**: The `apps/platform` shell uses a `scripts/build.py` tool that copies backend files byte-for-byte instead of using standard Python dependencies.
*   **Legacy Read-Model Engine**: `libs/shared-trace` contains giant recursive SQL queries and currently violates pure DDD layering rules. It acts as an authorized exception.
*   **Anemic Domain Models**: `warehouse360` has thin operational policies inside its domain layer.
*   **Deployment Scope Resets**: Databricks CLI bundle deployments routinely drop `user_api_scopes: ["sql"]`, breaking the passthrough auth. `deploy_app.py` or post-deploy scripts must patch this explicitly on every release.
*   **Local Auth Escapes**: `AUTH_ALLOW_UNVERIFIED_JWT` and `APP_TRUST_X_FORWARDED_HOST` exist for local dev but present risks if accidentally set in production.

## 6. Recommended Follow-up Jules Agents

*   **Jules (DDD Refactor)**: Migrate the empty domain layers in `warehouse360` to use the standard DDD base classes in `shared-ddd`.
*   **Jules (Decomposition)**: Refactor the monolithic read-model engine inside `libs/shared-trace` into context-specific repositories that follow the 4-layer pattern.
*   **Jules (Platform Architecture)**: Rewrite the `apps/platform` app factory to consume backend modules via Python Wheels rather than byte-for-byte file duplication during the build step.
*   **Jules (Auth Hardening)**: Complete the remaining security hardening findings (H3, H5) from the 2026-05-07 Senior Architect review.
