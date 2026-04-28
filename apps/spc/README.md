# SPC App — Statistical Process Control on Databricks

A **Databricks App** that delivers real-time Statistical Process Control (SPC)
charting and batch traceability for manufacturing quality teams, backed by a
Databricks SQL Warehouse and Unity Catalog.

## 📚 Documentation

Detailed documentation is available in the `docs/` folder:

- [**Architecture Overview**](./docs/architecture.md): Deep dive into the system design, analytics engine, and data flow.
- [**Local Setup Guide**](./docs/setup.md): Prerequisites and step-by-step instructions for running the app locally.
- [**API Reference**](./docs/api.md): Detailed information on backend endpoints and request models.

---

## Features

### SPC Module
- **Control Charts** — I-MR, X̄-R, X̄-S, EWMA, CUSUM, and attribute charts (`P`, `nP`, `C`, `U`)
- **Advanced Capability** — **Cp, Cpk** (short-term) and **Pp, Ppk** (long-term) calculation scores with 95% confidence intervals
- **Non-Parametric Analysis** — Automatic fallback to percentile-based capability ($P_{0.135}$, $P_{99.865}$) for non-normal datasets
- **Rule Detection** — WECO (4 rules) and Nelson (8 rules) out-of-control signals
- **P-Chart / nP-Chart** — Proportion nonconforming charts for attribute data
- **Dynamic Stratification** — Slice charts and scorecards by **Plant, Lot, or Operation**
- **Process Flow** — DAG showing upstream/downstream material lineage with health colouring and configurable lineage depth
- **Multivariate SPC** — Hotelling's T² control chart for coordinated drift across multiple characteristics
- **Root-Cause Suggestions** — Contributor ranking for multivariate anomalies using covariance-weighted decomposition
- **Correlation Explorer** — Interactive heatmap showing pairwise coupling across the same shared-batch population
- **Manual Point Exclusion** — Click any point to exclude it from limit recalculation with audit justification
- **Cursor-based Pagination** — High-performance data fetching for massive batch histories
- **Exports** — Excel and CSV export for scorecards, chart data, and signals

### Traceability Module
- **Recursive Batch Trace** — Top-down/Bottom-up trace up to 10 levels deep with cycle detection
- **Recall Readiness** — Immediate identification of affected customers and cross-batch exposure
- **Batch Intelligence** — Integrated CoA results and mass balance KPIs

### Platform
- **Token Passthrough Security** — User's OIDC token passed directly to SQL; Unity Catalog policies enforced natively
- **Zero-Trust Architecture** — No credential storage; every query auditable to the signed-in user
- **Layered Backend** — Clean Separation of Concerns via Routers, DAL, and Schemas

---

## Architecture

```
Databricks Apps Runtime
    │
    └── uvicorn → FastAPI (Python)
          ├── /api/spc/*           SPC Routers (backend/routers/)
          ├── /api/trace           Batch traceability (backend/routers/trace.py)
          ├── /api/health          Liveness probe
          ├── /api/ready           SQL-backed readiness probe
          └── /assets + /*         Serves React SPA (frontend/dist/)

React SPA (Vite + TypeScript)
    ├── SPCPage              Tab shell: Overview | Flow | Charts | Scorecard | Advanced analysis
    ├── SPCFilterBar         Material → Dynamic Stratification → Date range
    ├── SPCContext           Reducer-backed local UI/workbench state
    ├── TanStack Query       Server-state caching for metadata, summary, and analytical reads
    ├── spc/dal/             Data Access Layer (PyPika SQL Builders)
    ├── spc/charts/          IMR, XbarR/S, EWMA, CUSUM, P, Capability, T² & Signals Panels
    └── spc/scorecard/       ScorecardView (Carbon DataTable with sorting)
```

The FastAPI backend is built with a layered architecture:
*   **Routers** handle HTTP logic, validation, and rate limiting.
*   **Schemas** define Pydantic models for request/response contracts.
*   **Data Access Layer (DAL)** manages programmatic SQL generation via **PyPika**, ensuring injection safety and deterministic data formatting.

SQL is executed through a swappable adapter in `backend/utils/db.py` which delegates to `shared-db`.

---

## Local Development

For general monorepo setup, see the [Monorepo Development Guide](../../docs/monorepo-development.md).

### 1 — Setup

```bash
cd apps/spc
cp .env.example .env
# Configure your workspace host and warehouse ID in .env
```

### 2 — Backend

```bash
uv run --package apps/spc uvicorn backend.main:app --reload --port 8000
```

To exercise the readiness probe locally, set a dedicated Databricks token:

```bash
export DATABRICKS_READINESS_TOKEN=...
curl http://localhost:8000/api/ready
```

### 3 — Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Security Model

Every query runs as the signed-in user. The app performs no app-level filtering; instead, it relies on **Unity Catalog** row and column-level security policies enforced at the storage layer.

| HTTP Status | Meaning |
|---|---|
| `401` | Token missing or expired |
| `403` | User lacks Unity Catalog permission on the requested view |
| `500` | SQL failure or environment misconfiguration |

### Health vs Readiness

| Endpoint | Purpose |
|---|---|
| `/api/health` | Process liveness only — confirms the FastAPI app is running |
| `/api/ready` | Connectivity & Schema check — performs a SQL warehouse probe and validates gold-view schema against the frozen contract |

Because the app normally relies on per-user token passthrough, readiness needs its own non-user workspace token to verify warehouse connectivity and schema integrity before traffic is considered safe.

---

## Statistical Methods

Calculations strictly follow the **AIAG SPC Reference Manual (4th Edition)** and **Western Electric SQC Handbook**.

See [`docs/STATISTICAL_METHODS.md`](docs/STATISTICAL_METHODS.md) for full mathematical definitions.

---

## Testing

The application includes a professional, enforceable test suite covering both the backend and frontend.

### Backend Tests (Python)
The suite uses `pytest` with `hypothesis` for property-based testing and enforces a coverage floor.
```bash
# Run all unit tests (Enforces >=75% coverage)
uv run pytest
```

### Frontend Tests (React)
The suite uses `vitest` and `React Testing Library`.
```bash
cd frontend
npm test
```

For more details, see [tests/README.md](tests/README.md).

---

## Deployment

Use the shared deployment script from the root:

```bash
python3 ../../scripts/deploy_app.py --app-dir . --action deploy --profile uat
```
