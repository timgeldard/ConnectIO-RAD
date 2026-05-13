# Architecture Boundaries & Guardrails Report

## 1. Current Boundary Model
ConnectIO-RAD is structured as a **Modular Monolith** using a Domain-Driven Design (DDD) approach. The migration to this architecture was completed and marked as **Frozen** on May 5, 2026. The key boundaries are:

- **Four-Layer Architecture (per bounded context)**:
  - `domain/`: Contains pure business logic, entities, and value objects. Must be infrastructure and transport agnostic.
  - `application/`: Application services, use cases, and orchestrators. Coordinates between domain, DAL, and other bounded contexts.
  - `dal/`: Data Access Layer handling SQL/Delta interactions with Databricks.
  - `router.py`: Handles HTTP/FastAPI concerns, schema validation, and dependency injection.
- **Bounded Contexts**: Applications like Trace2, SPC, and EnvMon are partitioned into distinct bounded contexts (e.g., `batch_trace`, `inspection_analysis`). Contexts are independent; cross-context communication must happen via the `application/` layer, except for approved exceptions.
- **Shared Libraries**: Provide foundation (`shared-ddd`, `shared-manufacturing`), common infrastructure (`shared-db`, `shared-auth`), and core utilities.

## 2. Known Boundary Risks
- **Spaghetti Code & Leakage**:
  - Directly importing a sibling context’s `dal/` or `domain/` inside another context's `application/` or `router/`.
  - Importing transport libraries (like `fastapi`, `pydantic`) or infrastructure libraries (like `sqlalchemy`, `databricks`) inside the `domain/` layer.
- **Legacy Tech Debt**:
  - `shared-trace` acts as a monolithic read-model engine with complex SQL and requires decomposition.
  - Certain cross-context exceptions exist (e.g. `trace2_backend.batch_trace.dal.trace_core` and `warehouse360_backend.inventory_management.domain.plant_scope`) that should be refactored eventually.
- **Transport Exceptions**:
  - Genie client integration carries known transport dependencies (e.g. `starlette` / `HTTPException` inside `application/genie_client.py`).

## 3. Recommended File Ownership Map
To manage and maintain the frozen architecture, files are logically grouped into the following ownership profiles:

- **Core Applications (`apps/<app>/backend/<app>_backend/`)**: Owned by domain-specific feature teams.
  - Subdirectories (Bounded Contexts) manage their own `domain`, `application`, `dal`, and `router`.
- **Shared Libraries (`libs/`)**: Owned by platform / architecture teams.
  - `shared-ddd`, `shared-manufacturing`, `shared-db`, `shared-auth`.
- **UI Applications (`apps/<app>/frontend/`)**: Owned by frontend teams, consuming backend via standard API schemas.

## 4. Suggested Jules-Safe Change Zones
AI agents like Jules can confidently operate in the following areas where risks of architectural violations are low and test coverage is strong:
- **`domain/` (Within existing contexts)**: Adding new methods to existing entities/value objects, implementing pure domain logic, writing domain unit tests.
- **`router.py`**: Adding or updating HTTP endpoints, defining request/response Pydantic models.
- **`dal/`**: Adding new SQL queries or updating existing repository methods, as long as it doesn't introduce cross-context imports.
- **`application/`**: Creating new use cases that orchestrate existing domain models and DAL functions.
- **Frontend / UI**: Safely updating React components, TanStack query hooks, or shared UI tokens.

## 5. Suggested Human-Review-Only Zones
Modifications to these areas carry significant architectural or systemic risk and require strict human review:
- **Architecture Validation Tools**: Changes to `scripts/tests/test_ddd_architecture_guardrails.py`, `.importlinter`, and CI/CD validation scripts.
- **Shared DDD Foundations**: Modifying base classes in `libs/shared-ddd` or `libs/shared-manufacturing` (e.g. `Entity`, `AggregateRoot`).
- **Bounded Context Boundaries**: Creating entirely new bounded contexts or modifying the `ALLOWED_CONTEXTS` list.
- **Legacy Decomposition**: Refactoring the massive SQL models in `shared-trace`.
- **Security & Auth Core**: Any changes to `shared-auth` or core identity resolution.
