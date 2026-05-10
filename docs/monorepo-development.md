# Monorepo Development Guide

This guide covers the local development setup, toolchain, and common workflows for the `ConnectIO-RAD` monorepo.

## 🛠️ Prerequisites

Ensure you have the following tools installed:
- **Node.js 20+** and **npm**
- **Python 3.10+**
- **uv** (Fast Python package installer and resolver)
- **Databricks CLI** (for deployment and remote interaction)

## 📥 Getting Started

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/timgeldard/ConnectIO-RAD.git
    cd ConnectIO-RAD
    ```

2.  **Install Node.js dependencies**:
    ```bash
    npm install
    ```

3.  **Install Python dependencies and sync workspace**:
    ```bash
    uv sync
    ```

## 🔄 Development Workflows

We use **Nx** to orchestrate tasks across the monorepo.

### Common Commands

| Task | Command | Description |
| :--- | :--- | :--- |
| **Lint** | `npm run lint` | Run Ruff (Python) and ESLint (TS) on all projects. |
| **Test** | `npm run test` | Run Pytest and Vitest across all projects. |
| **Build** | `npm run build` | Build all frontend applications. |
| **Typecheck**| `npm run typecheck`| Run `tsc` across all frontend projects. |
| **Graph** | `npm run graph` | Visualize project dependencies. |

### Working with Specific Apps

You can target specific applications using Nx:
```bash
# Start SPC frontend development server
npx nx run spc-frontend:dev

# Run tests for envmon backend
npx nx run envmon-backend:test
```

## 🐍 Python Workspace (`uv`)

This monorepo uses `uv` workspaces for Python. Shared libraries in `libs/` are automatically linked to the applications that depend on them.

- To add a dependency to an app:
  ```bash
  cd apps/my-app/backend
  uv add some-package
  ```
- To run a command in the virtual environment:
  ```bash
  uv run pytest
  ```

## ⚛️ Frontend Workspaces (`npm`)

Frontend projects use standard npm workspaces defined in the root `package.json`.

- `apps/*/frontend`
- `libs/shared-frontend-api`

Vite is used as the build tool for all frontend applications, providing fast HMR and optimized builds.

## 📝 Code Standards

- **Python**: We follow PEP8, enforced by **Ruff**.
- **TypeScript**: We use **ESLint** and **Prettier** for code formatting and quality.
- **Git**: Follow conventional commits for clear history.

### 📚 Internal Documentation (10/10 Standard)

Every code change must adhere to the **10/10 Documentation Standard** defined in `GEMINI.md`:

- **Python (PEP 257)**: Every function, class, and module must have a multi-line docstring. Complex logic requires `Args:`, `Returns:`, and `Raises:` sections.
- **TypeScript/React (JSDoc)**: Every exported interface, type, component, and custom hook must have `/** ... */` JSDoc annotations. Component props must be individually documented.
- **Why over What**: Non-obvious algorithms or business logic must have inline comments explaining the "why" behind the implementation.

### 🔐 Shared Infrastructure Hardening

Shared backend infrastructure (`libs/shared-api`, `libs/shared-auth`,
`libs/shared-db`) carries the repo-wide trust-boundary safeguards. When
hardening these layers:

- Keep the changes inside the shared infra libraries; do not move the logic into
  app/application/domain packages because the DDD boundaries are frozen.
- Treat forwarded headers as untrusted until validated or sanitized.
- Keep production authentication proxy-first: `x-forwarded-access-token` remains
  the canonical credential path, with Bearer fallback limited to local/test
  workflows.
- Mask internal readiness and infra failures in client responses and use
  correlation IDs for operator follow-up.
- Accept only safe SQL identifiers in shared query-building helpers so app DALs
  inherit the same constraints automatically.
