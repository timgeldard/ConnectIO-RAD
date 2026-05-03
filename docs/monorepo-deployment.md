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

Runtime authentication also requires JWT validation to be configured for
deployed FastAPI services:

- `AUTH_JWKS_URL`: JWKS endpoint used to verify Databricks Apps access tokens.
- `AUTH_JWT_AUDIENCE`: Expected JWT audience. Optional only when the issuer does not set audience claims.
- `AUTH_JWT_ISSUER`: Expected JWT issuer. Optional, but recommended for production.
- `AUTH_ALLOW_UNVERIFIED_JWT`: Emergency/local-only escape hatch for unsigned JWT decoding. Do not enable in production.

Local and test runs may use `APP_ENV=local`, `APP_ENV=development`, or
`APP_ENV=test` to allow developer tokens without JWKS. Production runtimes must
set `AUTH_JWKS_URL`.

## 📦 Build Artifacts

Frontend builds are typically output to the `dist/` directory within each application's frontend folder. The FastAPI backend is configured to serve these static files in the production environment.
