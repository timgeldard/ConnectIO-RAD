# 🚀 Getting Started with ConnectIO-RAD

Welcome aboard! This guide will help you set up your environment and understand the core workflows of the ConnectIO Reporting and Dashboarding (RAD) platform.

---

## 🐣 Persona-Based Quick Start

### 👨‍💻 For New Developers
1.  **Environment Setup**: Install Node.js 20+, Python 3.11+, and the `uv` package manager.
2.  **Clone & Link**: Run `npm install` and `uv sync`.
3.  **Run the Pilot**: `npx nx run template-frontend:dev`. This opens the "Template Module" on port 5173.
4.  **Read the Mandates**: Familiarize yourself with the [Engineering Mandates](../GEMINI.md).

### 📊 For Analysts / Citizen Developers
1.  **Access Databricks**: Ensure you have access to the Kerry Databricks Workspace (UAT).
2.  **Unity Catalog**: Explore the `connected_plant_uat` catalog. This is our primary data source.
3.  **SQL Exploration**: Use the SQL Editor to query views under `wh360`, `spc`, or `envmon` schemas.
4.  **Business Logic**: Read the [Domain Glossary](./domain-glossary.md) to understand manufacturing terms.

---

## 🛠️ Detailed Local Setup

### 1. Prerequisites
- **Git**: For source control.
- **Python 3.11+**: Our backend engine.
- **Node.js 20+**: Our frontend engine.
- **uv**: `curl -sSf https://astral.sh/uv/install.sh | sh`.

### 2. Workspace Initialization
```bash
# Clone the repo
git clone https://github.com/timgeldard/ConnectIO-RAD.git
cd ConnectIO-RAD

# Install JS dependencies (Nx, React, Vite)
npm install

# Setup Python Virtual Environment and sync libraries
uv sync
```

### 3. Running Applications
We use Nx to target specific apps. Every app has a `:dev` (frontend) and `:run` (backend) target.

```bash
# Start SPC (Statistical Process Control)
npx nx run spc-frontend:dev

# Start Warehouse360
npx nx run warehouse360-frontend:dev
```

---

## 🗺️ Repository Map

| Path | Purpose |
| :--- | :--- |
| `apps/` | Independent Databricks Apps (SPC, Trace2, etc.) |
| `libs/shared-api/` | Standardized FastAPI wrappers & security |
| `libs/shared-db/` | Databricks SQL DAL and tiered caching |
| `libs/shared-ui/` | Kerry Design System components and Shell |
| `docs/` | Comprehensive technical and business documentation |
| `scripts/` | Validation scripts (i18n, DDD guardrails) |

---

## 📐 Key Concepts

### Bounded Contexts
We follow strict DDD. An application like `Warehouse360` is split into internal contexts (e.g., `inventory_management`, `dispensary_ops`). Each has its own:
- **Domain**: pure logic.
- **Application**: service orchestrators.
- **DAL**: SQL queries.

### Shared Infrastructure
Never rewrite authentication or DB logic. Use `libs/shared-*`. These libraries ensure that every app in the monorepo is automatically secured and optimized for Databricks SQL.

---

## ❓ Troubleshooting

### "ImportError: No module named 'shared_api'"
Ensure you have run `uv sync` from the **root** of the monorepo. `uv` handles the workspace path linking.

### "NX   Running target dev for 1 project(s) failed"
Check if the port (e.g., 5173) is already in use by another app or a ghost process.

### "401 Unauthorized" from Backend
When running locally, set `APP_ENV=dev` in your environment. This enables the bypass for Databricks proxy headers.

---

## 🏁 Definition of Done
A task is not complete until:
- [ ] Logic is in the correct **Bounded Context**.
- [ ] **Tests** pass and meet ≥75% coverage.
- [ ] **i18n** translations added for all 16 languages.
- [ ] **JSDoc/PEP 257** docstrings are 10/10.
