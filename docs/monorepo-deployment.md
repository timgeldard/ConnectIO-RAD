# Monorepo Deployment Guide

This document outlines the CI/CD pipelines and deployment strategies for the `ConnectIO-RAD` applications.

## 🚀 CI/CD Overview

We use **GitHub Actions** for continuous integration and deployment. The pipeline is optimized using **Nx affected** to only run tasks for projects that have changed in a given Pull Request or Push to `master`.

### Pipeline Stages

1.  **Sync**: Synchronizes Python environments for affected projects.
2.  **Lint**: Runs static analysis (Ruff, ESLint).
3.  **Typecheck**: Validates TypeScript types.
4.  **Test**: Executes unit and integration tests (Pytest, Vitest).
5.  **Build**: Compiles frontend assets into static files.
6.  **Deploy**: (Master branch only) Deploys changed applications to Databricks.

## ☁️ Databricks Apps Deployment

Applications are deployed as **Databricks Apps**. Each application directory (e.g., `apps/spc/`) contains a `databricks.yml` file that defines the app's configuration and deployment settings.

### Manual Deployment

To manually deploy an application using the Databricks CLI:
```bash
cd apps/my-app
databricks apps deploy my-app-name
```

### Automation via Nx

The root `nx.json` and project-specific `project.json` files define a `deploy` target. This target handles the frontend build and then triggers the Databricks deployment.

```bash
# Deploy only the affected apps
npx nx affected -t deploy --base=HEAD~1
```

## 🔐 Secrets Management

Deployment requires the following secrets to be configured in GitHub Actions:
- `DATABRICKS_HOST`: The URL of your Databricks workspace.
- `DATABRICKS_TOKEN`: A Personal Access Token (PAT) with sufficient permissions to deploy apps.

## 📦 Build Artifacts

Frontend builds are typically output to the `dist/` directory within each application's frontend folder. The FastAPI backend is configured to serve these static files in the production environment.
