# trace2 Local Setup Guide

Follow these steps to set up the Batch Traceability (trace2) application for local development.

## 📋 Prerequisites

- Node.js 20+
- Python 3.10+
- `uv`

## 🛠️ Step-by-Step Setup

1.  **Navigate to the app directory**:
    ```bash
    cd apps/trace2
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

### Start the Backend
```bash
cd apps/trace2/backend
uv run uvicorn main:app --reload --port 8002
```

### Start the Frontend
```bash
cd apps/trace2/frontend
npm run dev
```
The frontend will be available at `http://localhost:5173`. It is configured to proxy `/api` requests to the backend at `http://localhost:8002`.

## 🧪 Testing

- **Backend Tests**: `uv run pytest` in the `backend/` directory.
- **Frontend Tests**: `npm run test` in the `frontend/` directory.

## 🚢 Deployment

The `trace2` app is deployed as a Databricks App.

```bash
# From the root of apps/trace2
databricks apps deploy trace2
```
*Note: Ensure your Databricks profile and `databricks.yml` variables are correctly configured.*
