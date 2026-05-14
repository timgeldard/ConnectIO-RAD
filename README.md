# 🚀 ConnectIO-RAD

The industrial-grade monorepo for Kerry's **Reporting and Dashboarding (RAD)** platform on Databricks.

ConnectIO-RAD powers manufacturing visibility, quality excellence, and supply chain efficiency across Kerry's global plant network.

---

## 📖 Central Documentation Hub

The **[Developer Portal](./docs/INDEX.md)** is your main entry point for the project.

### 🐣 Quick Links
- **[Onboarding Guide](./docs/ONBOARDING.md)**: Set up your environment in <10 minutes.
- **[Architecture Overview](./ARCHITECTURE.md)**: Bounded contexts, data flows, and design principles.
- **[API Documentation](./docs/API_STRATEGY.md)**: Strategy for discoverability and OpenAPI standards.
- **[Engineering Mandates](./GEMINI.md)**: Our strict "Definition of Done" for PRs.
- **[Testing Strategy](./docs/TESTING_STRATEGY.md)**: Coverage, E2E, and visual regression.

---

## 🏗️ Monorepo Applications

| Application | Domain | Status |
| :--- | :--- | :--- |
| **`platform`** | Unified Shell & Portal | 🟢 Production |
| **`warehouse360`** | Warehouse & Inventory | 🟢 Production |
| **`spc`** | Statistical Quality Control | 🟡 UAT |
| **`trace2`** | Batch Traceability | 🟡 UAT |
| **`envmon`** | Environmental Monitoring | 🟡 UAT |
| **`processorderhistory`** | Manufacturing Insights | ⚪ Pilot |
| **`template`** | New Module Reference | 🔵 Demo |

---

## 🛠️ Stack at a Glance

- **Backend**: Python 3.11+ / FastAPI / Databricks SQL.
- **Frontend**: React 18.3.1 / TypeScript / Vite.
- **Orchestration**: Nx (Monorepo Tooling).
- **Data**: Unity Catalog / Medallion Architecture.

---

## 🔌 API Discovery (Local)

When running locally, explore our interactive Swagger docs:
- **spc**: `:8000/api/docs`
- **envmon**: `:8001/api/docs`
- **trace2**: `:8002/api/docs`
- **wh360**: `:8004/api/docs`

---

## 🤝 Contributing

We value resilience and precision. Please ensure all contributions follow our **Domain-Driven Design** boundaries and meet our **75% test coverage** requirement.

See **[CONTRIBUTING.md](./CONTRIBUTING.md)** for more details.
