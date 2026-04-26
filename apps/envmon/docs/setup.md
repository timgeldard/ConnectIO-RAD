# envmon Local Setup Guide

Follow these steps to set up the Environmental Monitoring app for local development.

## 📋 Prerequisites

- Node.js 20+
- Python 3.10+
- `uv` (installed globally: `curl -LsSf https://astral.sh/uv/install.sh | sh`)

## 🛠️ Step-by-Step Setup

1.  **Navigate to the app directory**:
    ```bash
    cd apps/envmon
    ```

2.  **Install Frontend Dependencies**:
    ```bash
    cd frontend
    npm install
    ```

3.  **Install Backend Dependencies**:
    ```bash
    cd ../backend
    uv sync
    ```

## 🚀 Running Locally

You can run both the frontend and backend simultaneously for development.

### Start the Backend
```bash
cd apps/envmon/backend
uv run uvicorn main:app --reload --port 8000
```

### Start the Frontend
```bash
cd apps/envmon/frontend
npm run dev
```
The frontend will be available at `http://localhost:5173`. It is configured to proxy `/api` requests to the backend at `http://localhost:8000`.

## 🧪 Testing

- **Backend Tests**: `uv run pytest` in the `backend/` directory.
- **Frontend Tests**: `npm run test` in the `frontend/` directory.

## 🚢 Deployment

Deployment is managed via the Databricks CLI and the `databricks.yml` file.

```bash
# From the root of apps/envmon
databricks apps deploy envmon
```
*Note: Ensure your Databricks profile is correctly configured.*
