# ConnectIO-RAD — Agent Context

## Repo Structure

This is an Nx monorepo containing three Databricks Apps:

| App | Path | Purpose |
|---|---|---|
| `envmon` | `apps/envmon/` | Environmental monitoring — MIC inspection heatmaps |
| `spc` | `apps/spc/` | Statistical process control — control charts and alarms |
| `trace2` | `apps/trace2/` | Batch traceability — forward/reverse trace and mass balance |

Shared libraries live in `libs/`. Each app has `frontend/` (React/TypeScript/Vite) and `backend/` (FastAPI/Python) directories.

## Agent Orientation — Start Here

Before writing any code, read these files in order:

1. `ai-context/rules/agent_working_rules.md` — operating contract (data layer, naming, security)
2. `ai-context/semantic-model/entities.yaml` — approved tables and columns
3. `ai-context/semantic-model/joins.yaml` — approved join paths
4. `ai-context/glossary/business_terms.md` — domain vocabulary
5. `ai-context/examples/canonical_sql.sql` — approved SQL patterns

For frontend work, also read `ai-context/rules/frontend_rules.md`.
For backend work, also read `ai-context/rules/backend_rules.md`.

## Key Conventions

- Backend: FastAPI + Databricks SQL Statement API, DAL pattern (`dal/` directory), `tbl()` for table refs, `:param` for SQL parameters
- Frontend: React 18 + TypeScript + Vite, inline styles + CSS variables, no heavy UI libraries
- All SQL targets gold-layer views only — never bronze or silver
- Catalog resolved via `{{CATALOG}}` / `tbl()` — never hardcoded
- Auth via `x-forwarded-access-token` (Databricks Apps proxy)

## Semantic Model Status

`ai-context/semantic-model/entities.yaml` covers cross-app entities (material, batch lineage, inventory, OEE).
App-specific entities (e.g. `gold_inspection_lot` for envmon, SPC-specific views) should be added to entities.yaml when working on those apps.
