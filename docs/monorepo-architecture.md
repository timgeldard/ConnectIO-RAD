# Monorepo Architecture Overview

This document provides a high-level overview of the `ConnectIO-RAD` monorepo architecture, technology stack, and component interactions.

## 🏗️ High-Level Architecture

The repository follows a monorepo structure, housing multiple applications and shared libraries. It is designed to be deployed primarily as **Databricks Apps**, leveraging Databricks SQL Warehouse and Unity Catalog for data storage and management.

```mermaid
graph TD
    subgraph "Applications (apps/)"
        CQ[connectedquality]
        EM[envmon]
        POH[processorderhistory]
        PLAT[platform]
        SPC[spc]
        T2[trace2]
        W360[warehouse360]
    end

    subgraph "Shared Libraries (libs/)"
        S_API[shared-api]
        S_AUTH[shared-auth]
        S_DB[shared-db]
        S_DOM[shared-domain]
        S_FE[shared-frontend-api]
        S_TR[shared-trace]
    end

    subgraph "Data & Compute (Databricks)"
        UC[Unity Catalog]
        SQLW[SQL Warehouse]
        DAPP[Databricks Apps Runtime]
    end

    %% Dependencies
    EM -- uses --> S_DB
    EM -- uses --> S_AUTH
    EM -- uses --> S_DOM
    SPC -- uses --> S_DB
    SPC -- uses --> S_AUTH
    SPC -- uses --> S_DOM
    T2 -- uses --> S_DB
    T2 -- uses --> S_AUTH
    T2 -- uses --> S_TR
    T2 -- uses --> S_DOM
    POH -- uses --> S_DB
    POH -- uses --> S_DOM
    W360 -- uses --> S_DB
    W360 -- uses --> S_DOM
    PLAT -- routes to --> CQ
    PLAT -- routes to --> EM
    PLAT -- routes to --> POH
    PLAT -- routes to --> SPC
    PLAT -- routes to --> T2
    PLAT -- routes to --> W360
    CQ -- routes to --> EM
    CQ -- routes to --> SPC

    EM -- runs on --> DAPP
    SPC -- runs on --> DAPP
    T2 -- runs on --> DAPP
    POH -- runs on --> DAPP
    W360 -- runs on --> DAPP
    CQ -- runs on --> DAPP
    PLAT -- runs on --> DAPP

    S_DB -- queries --> SQLW
    SQLW -- reads from --> UC
```

## 📐 Architectural Style

All applications follow a **Pragmatic Domain-Driven Design (DDD) / Modular Monolith** architecture. The apps are divided into bounded contexts containing:
- **Domain**: Pure business rules, Entities, and Value Objects. Inherit from `shared-domain`.
- **Application**: Use cases, query handlers, and response payload generation.
- **DAL**: Data access adapters (SQL) scoped specifically to their bounded context.
- **Routers**: Pure HTTP transport layer using FastAPI.

See [`docs/domain-glossary.md`](./domain-glossary.md) for a full inventory of contexts and domain models.


## 🚀 Technology Stack

### Backend
- **Language:** Python 3.10+
- **Framework:** FastAPI
- **Dependency Management:** `uv` (workspace-aware)
- **Deployment:** Databricks Apps (using `databricks.yml`)
- **Database:** Databricks SQL Warehouse (Unity Catalog)

### Frontend
- **Framework:** React (TypeScript)
- **Build Tool:** Vite
- **Dependency Management:** `npm` (workspaces)
- **State Management:** TanStack Query (React Query)
- **Styling:** Vanilla CSS / SCSS (Kerry Design System tokens)

### Monorepo Tooling
- **Orchestration:** [Nx](https://nx.dev/) is used to manage builds, tests, linting, and deployments across all projects.
- **Task Runner:** `nx affected` is used in CI/CD to run tasks only on changed components.

## 📦 Shared Libraries (`libs/`)

Shared libraries promote code reuse and consistency across applications:

- **`shared-api`**: Common FastAPI utilities, error handlers, and middleware.
- **`shared-auth`**: Authentication and security logic for Databricks environments.
- **`shared-db`**: Database connection management and async SQL execution.
- **`shared-domain`**: Base classes for DDD: `Entity`, `ValueObject`, `AggregateRoot`.
- **`shared-frontend-api`**: Shared TypeScript clients and models.
- **`shared-trace`**: Shared domain logic for material and batch traceability.

## 📂 Project Structure

```text
.
├── apps/               # Independent applications
│   ├── connectedquality/ # Quality monitoring & alerting
│   ├── envmon/         # Environmental Monitoring
│   ├── platform/       # Unified Shell & Portal
│   ├── processorderhistory/ # Order execution & analytics
│   ├── spc/            # Statistical Process Control
│   ├── trace2/         # Batch Traceability
│   └── warehouse360/   # Warehouse Operations Cockpit
├── libs/               # Shared Python and TypeScript libraries
├── docs/               # Global documentation
├── ai-context/         # Semantic models and agent rules
└── package.json        # Global Node.js configuration
```
