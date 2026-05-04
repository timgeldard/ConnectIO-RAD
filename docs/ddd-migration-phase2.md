# DDD Migration Plan: Phase 2

This document tracks the migration of the remaining applications (`processorderhistory`, `warehouse360`, and gateway apps) to a Pragmatic DDD / Modular Monolith architecture.

## 1. `processorderhistory` Migration

**Target Contexts:**
- `order_execution`: Core operational reality (orders, details, day view, pours, me).
- `production_planning`: Future scheduling (planning, vessel planning).
- `manufacturing_analytics`: Retrospective performance (OEE, yield, downtime, adherence, equipment insights, quality).
- `genie_assist`: Natural language interface.

**Checklist:**
- [x] **Setup Structure**: Create `domain`, `application`, and `dal` folders inside each bounded context folder.
- [x] **Extract Domain Models**: Identify and extract pure business logic, invariants, and value objects (e.g., OEE calculations, status parsing) into the `domain` layers. Create domain unit tests.
- [x] **Migrate DAL**: Move or wrap existing DAL functions from `backend/dal/` into the context-specific `dal/` modules.
- [x] **Build Application Services**: Create `application/queries.py` or similar to handle orchestration, freshness, and errors.
- [x] **Refactor Routers**: Move existing routers into their respective contexts. Keep them thin.
- [x] **Add Compatibility Shims (if necessary)**: To maintain existing tests or avoid large refactors in `main.py` all at once.
- [x] **Add Architecture Tests**: Enforce boundary rules (Domain must not import FastAPI/DAL, etc.).
- [x] **Verify**: Ensure all tests pass (`pytest`).

## 2. `warehouse360` Migration

**Target Contexts:**
- `inventory_management`: Physical state (inventory, inbound, plants).
- `order_fulfillment`: Movement (deliveries, process_orders).
- `dispensary_ops`: Weighing tasks (dispensary).
- `operations_control_tower`: Aggregated metrics (kpis).

**Checklist:**
- [x] **Setup Structure**: Create standard DDD folders for each context.
- [x] **Extract Domain Models**: Value objects for stock status, bin capacity, delivery states. Create unit tests.
- [x] **Migrate DAL**: Wrap/move `backend/dal/` into context-specific `dal/`.
- [x] **Build Application Services**: Orchestrate DAL and Domain.
- [x] **Refactor Routers**: Move and thin out routers into context-specific `router.py`.
- [x] **Add Architecture Tests**: Enforce boundaries.
- [x] **Verify**: Run test suite.

## 3. Gateway Apps & Shared Libraries Cleanup

**Checklist:**
- [x] **`connectedquality`**: Isolate `prefs_store.py` into a `user_preferences` context. Treat the rest as integration/BFF routing.
- [x] **`libs/shared-trace`**: Analyze `shared_trace/dal.py`. Break it down into smaller, domain-specific packages if applicable, or document it as the finalized shared read-engine.
- [x] **Final Audit**: Run `consolidation_audit.py` to ensure all docs are updated.
