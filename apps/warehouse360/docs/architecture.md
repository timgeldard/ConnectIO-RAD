# Warehouse Operations Cockpit (warehouse360) Architecture

`warehouse360` is a high-fidelity frontend mockup for a warehouse operations cockpit, designed to provide a unified view of inbound, outbound, and inventory operations.

## 🏗️ System Design

Currently, `warehouse360` is primarily a frontend-driven application with a lightweight FastAPI backend for serving static assets.

### Frontend
- **Framework:** React with Vite.
- **Styling:** Custom CSS using Kerry Design System tokens.
- **Components:**
    - **Control Tower:** Central dashboard with key operational metrics and alerts.
    - **Inbound/Outbound:** Detailed views for monitoring shipment status and schedules.
    - **Inventory:** Real-time visibility into stock levels and storage locations.
    - **Production Staging:** Monitoring the flow of materials to production lines.
    - **Dispensary:** Managing the weighing and dispensing of raw materials.

### Backend
- **Framework:** FastAPI.
- **Project Structure:** Fully integrated with `uv` workspaces and `nx`.
- **Purpose:** Serves the compiled React application and provides a base structure for future API integration.
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

**Current state:** domain and application layers contain value objects and query handlers against mock data fixtures. When live SAP/WMS integration is completed, domain logic will deepen to enforce inventory invariants (e.g., quantity bounds, storage-type validation).

Architecture guardrail tests at `scripts/tests/test_ddd_architecture_guardrails.py` enforce these rules automatically on every CI run.

## 📊 Mock Data Strategy

To demonstrate the full capability of the cockpit without requiring a live connection to an ERP system, the application uses a comprehensive `mockData.js` file. This allows for:
- **Interactive UI:** Users can navigate through different views and interact with "real" looking data.
- **Prototyping:** Rapid iteration on UI/UX before finalizing backend requirements.

## 🔗 Future Data Flow

The intended architecture will mirror the other ConnectIO-RAD applications:
1.  **Integration:** Connecting to SAP or other warehouse management systems (WMS).
2.  **Aggregation:** Data will be processed and stored in Databricks Unity Catalog.
3.  **Consumption:** The FastAPI backend will serve real-time data from SQL Warehouse to the React frontend.
