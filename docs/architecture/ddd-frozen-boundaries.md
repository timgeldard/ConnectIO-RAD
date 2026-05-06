# DDD Frozen Boundaries Policy

## Overview
As of May 2026, the Domain-Driven Design (DDD) migration in the ConnectIO-RAD monorepo is formally **Frozen**. This document defines the strict governance rules for maintaining architectural integrity across all bounded contexts.

## ❄️ The "Frozen" Standard
"Frozen" means that the structural boundaries and layer responsibilities are finalized. Any change to these boundaries or the introduction of new bounded contexts requires an Architecture Decision Record (ADR) and explicit maintainer approval.

### 1. Bounded Context Map
We maintain 15 distinct bounded contexts across 5 core applications. See the Context Map in `docs/monorepo-architecture.md` for upstream/downstream relationships.

### 2. Layer Responsibilities
Every bounded context MUST strictly follow the 4-layer architecture:

| Layer | Responsibility | Allowed Dependencies |
| :--- | :--- | :--- |
| **`router.py`** | HTTP Transport, Request Parsing, Auth, DI. | `application`, `schemas`, `shared-api`. |
| **`application/`** | Use Case Orchestration, Query Handlers, Cross-context coordination. | `domain`, `dal`, Sibling `application` layers. |
| **`domain/`** | Pure Business Logic, Invariants, Aggregates, Entities, Value Objects. | `shared-domain` base classes ONLY. |
| **`dal/`** | Data Access, SQL queries, Databricks-specific persistence. | `shared-db`, technical utilities. |

### 3. Cross-Context Communication
- **Forbidden**: Direct imports between sibling `domain` layers.
- **Allowed**: `application` layer of Context A may import the `application` layer of Context B.
- **Allowed**: Routers may import the `application` layer of any context within the same app.
- **Forbidden**: Routers or Domain models importing any `dal` module.

## 🛡️ Enforcement & Guardrails
Boundary rules are automatically enforced via the following tools:

1.  **Architecture Guardrails**: `scripts/tests/test_ddd_architecture_guardrails.py`
    - Prevents forbidden imports (e.g., Domain → Infrastructure).
    - Prevents sibling domain-to-domain imports.
    - Prevents unauthorized new bounded contexts.
2.  **Domain Language Linter**: `scripts/validate_domain_language.py`
    - Warns if new code uses terms not defined in `docs/domain-glossary.md`.

## 🛠️ How to Add a New Feature
1.  **Identify the Context**: Determine which bounded context owns the new logic.
2.  **Logic Placement**:
    - **Invariants/Calculations** → `domain/` (pure function or value object).
    - **Data Retrieval/Orchestration** → `application/` (query or command handler).
    - **New SQL** → `dal/`.
3.  **Verification**: Run `uv run pytest scripts/tests/test_ddd_architecture_guardrails.py` to ensure no boundaries were breached.

## 🛑 Exceptions & Technical Debt
- **`shared-trace`**: Recognized as a legacy monolithic read-model engine. Refactoring it into context-specific repositories is encouraged but must follow the 4-layer pattern.
- **`warehouse360`**: Contexts are intentionally thin during the mock-data phase; deepening the domain logic here is required as live integration proceeds.
