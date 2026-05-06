# ConnectIO-RAD

An enterprise-grade monorepo for Rapid Application Development (RAD) on the Databricks platform. This repository contains a suite of industrial applications designed for manufacturing, quality, and supply chain operations.

## 📚 Documentation

Comprehensive documentation is available in the `/docs` directory:

- [**Engineering Mandates (DoD)**](./GEMINI.md): Strict standards for documentation, testing, and i18n coverage.
- [**Monorepo Architecture**](./docs/monorepo-architecture.md): Overview of the system design, shared libraries, and component interactions.
- [**Development Guide**](./docs/monorepo-development.md): Local setup, toolchain details, and common developer workflows.
- [**Deployment Guide**](./docs/monorepo-deployment.md): CI/CD pipelines and Databricks deployment strategies.

### 🔌 Interactive API Docs (Swagger)

Every application in this monorepo provides an auto-generated, interactive Swagger UI for API exploration and testing. When running locally, these are accessible at:

- **spc**: `http://localhost:8000/api/docs`
- **envmon**: `http://localhost:8001/api/docs`
- **trace2**: `http://localhost:8002/api/docs`
- **processorderhistory**: `http://localhost:8003/api/docs`
- **warehouse360**: `http://localhost:8004/api/docs`
- **connectedquality**: `http://localhost:8005/api/docs`
- **platform**: `http://localhost:8006/api/docs`

---

## 🚀 Applications

The following applications are housed within this monorepo:

| Application | Description | Documentation |
| :--- | :--- | :--- |
| **`platform`** | Unified Shell & Portal for all ConnectIO apps | [README](./apps/platform/README.md) |
| **`connectedquality`** | Cross-domain quality monitoring and alerting | [README](./apps/connectedquality/README.md) |
| **`envmon`** | Environmental Monitoring Visualisation | [README](./apps/envmon/README.md) |
| **`spc`** | Statistical Process Control & Traceability | [README](./apps/spc/README.md) |
| **`trace2`** | Comprehensive Batch Traceability | [README](./apps/trace2/README.md) |
| **`warehouse360`** | Warehouse Operations Cockpit (Mockup) | [README](./apps/warehouse360/README.md) |
| **`processorderhistory`** | Plant-floor view of process order execution | [README](./apps/processorderhistory/README.md) |

---

## 📦 Shared Libraries

Common logic and utilities are shared across applications to ensure consistency:

- **`libs/shared-api`**: FastAPI utilities and common middleware.
- **`libs/shared-auth`**: Authentication and security for Databricks environments.
- **`libs/shared-db`**: Database connection management and async SQL execution.
- **`libs/shared-frontend-api`**: Shared TypeScript clients and data models.
- **`libs/shared-frontend-i18n`**: Shared i18n logic and validation.
- **`libs/shared-trace`**: Shared domain logic for material traceability.

## 🛠️ Tech Stack

- **Backend**: Python, FastAPI, Databricks Apps, SQL Warehouse.
- **Frontend**: React, Vite, TypeScript, Nx.
- **Orchestration**: Nx (build, test, lint, deploy).
- **Dependency Management**: `uv` (Python), `npm` (Node.js).
- **Internationalization**: i18next with 13 standard languages enforced.
