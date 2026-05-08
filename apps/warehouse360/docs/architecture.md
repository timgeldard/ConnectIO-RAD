# Warehouse Operations Cockpit (warehouse360) Architecture

`warehouse360` is a live-wired warehouse operations cockpit, designed to provide a unified view of inbound, outbound, inventory, production staging, dispensary, and IM/WM reconciliation operations.

## 🏗️ System Design

`warehouse360` is a React application backed by FastAPI routers that query Databricks SQL through bounded-context application services.

### Frontend
- **Framework:** React with Vite.
- **Styling:** Custom CSS using Kerry Design System tokens.
- **Components:**
    - **Control Tower:** Central dashboard with key operational metrics and alerts.
    - **Inbound/Outbound:** Detailed views for monitoring shipment status and schedules.
    - **Inventory:** Real-time visibility into stock levels and storage locations.
    - **Inventory Cockpit:** IM/WM reconciliation, exception triage, movement activity, and aging analytics.
    - **Production Staging:** Monitoring the flow of materials to production lines.
    - **Dispensary:** Managing the weighing and dispensing of raw materials.

### Backend
- **Framework:** FastAPI.
- **Project Structure:** Fully integrated with `uv` workspaces and `nx`.
- **Purpose:** Serves the compiled React application and exposes live warehouse, inventory, control tower, and IM/WM API endpoints.
- **Testing:** Comprehensive unit tests for core API routes and application readiness.

## DDD Layer Boundaries

`warehouse360` is structured as a pragmatic DDD modular monolith following the same boundary rules as the other ConnectIO-RAD apps (see `docs/adr/ddd-migration-architecture.md`). The backend is organized into four bounded contexts:

| Context | Purpose | Layer status |
|---|---|---|
| `dispensary_ops` | Weighing and dispensing of raw materials | domain + application + dal |
| `inventory_management` | Real-time stock levels and storage location queries | domain + application + dal |
| `order_fulfillment` | Inbound/outbound shipment monitoring | domain + application + dal |
| `operations_control_tower` | KPI aggregation and alert surfacing | domain + application + dal |

All four contexts follow the standard four-layer boundary:

| Layer | Allowed imports | Forbidden imports |
|---|---|---|
| `domain/` | stdlib, `shared-domain` base classes | fastapi, dal, schemas, router |
| `application/` | domain, dal | fastapi request/response types, routers |
| `dal/` | db utils, SQL runtime | domain, application |
| `router.py` | application, schemas, rate limit, auth | dal, SQL runtime |

**Current state:** application services delegate to DAL modules backed by Databricks SQL views and tables. Domain logic remains intentionally lightweight where source-system invariants are enforced upstream.

Architecture guardrail tests at `scripts/tests/test_ddd_architecture_guardrails.py` enforce these rules automatically on every CI run.

## 🔗 Data Flow

1.  **Integration:** SAP and warehouse-management extracts land in Databricks.
2.  **Aggregation:** Domain views in Unity Catalog shape the operational read models.
3.  **Consumption:** FastAPI routers serve Databricks SQL results to the React frontend.
