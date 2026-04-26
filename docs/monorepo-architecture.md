# Monorepo Architecture Overview

This document provides a high-level overview of the `ConnectIO-RAD` monorepo architecture, technology stack, and component interactions.

## 🏗️ High-Level Architecture

The repository follows a monorepo structure, housing multiple applications and shared libraries. It is designed to be deployed primarily as **Databricks Apps**, leveraging Databricks SQL Warehouse and Unity Catalog for data storage and management.

```mermaid
graph TD
    subgraph "Applications (apps/)"
        EM[envmon]
        SPC[spc]
        T2[trace2]
        W360[warehouse360]
    end

    subgraph "Shared Libraries (libs/)"
        S_API[shared-api]
        S_AUTH[shared-auth]
        S_DB[shared-db]
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
    SPC -- uses --> S_DB
    SPC -- uses --> S_AUTH
    T2 -- uses --> S_DB
    T2 -- uses --> S_AUTH
    T2 -- uses --> S_TR

    EM -- runs on --> DAPP
    SPC -- runs on --> DAPP
    T2 -- runs on --> DAPP

    S_DB -- queries --> SQLW
    SQLW -- reads from --> UC
```

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
- **`shared-auth`**: Authentication and security logic, specifically for Databricks environment integration.
- **`shared-db`**: Database connection management and asynchronous SQL execution utilities.
- **`shared-frontend-api`**: Shared TypeScript clients and models for frontend-backend communication.
- **`shared-trace`**: Domain-specific logic for material and batch traceability.

## 📂 Project Structure

```text
.
├── apps/               # Independent applications
│   ├── envmon/         # Environmental Monitoring
│   ├── spc/            # Statistical Process Control
│   ├── trace2/         # Batch Traceability
│   └── warehouse360/   # Warehouse Operations Cockpit
├── libs/               # Shared Python and TypeScript libraries
├── docs/               # Global documentation
├── ai-context/         # Semantic models and agent rules
└── package.json        # Global Node.js configuration
```
