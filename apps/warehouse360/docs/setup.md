# warehouse360 Local Setup Guide

Follow these steps to set up the Warehouse Operations Cockpit mockup for local development.

## 📋 Prerequisites

- Node.js 20+
- Python 3.10+
- `uv`

## 🛠️ Step-by-Step Setup

1.  **Navigate to the app directory**:
    ```bash
    cd apps/warehouse360
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
cd apps/warehouse360/backend
uv run uvicorn main:app --reload --port 8003
```

### Start the Frontend
```bash
cd apps/warehouse360/frontend
npm run dev
```
The frontend will be available at `http://localhost:5173`.

## 🧪 Testing

- **Backend Tests**: `uv run pytest` in the `backend/` directory.
- **Frontend Tests**: `npm run test` in the `frontend/` directory.

## 🚢 Deployment

The `warehouse360` app can be deployed as a Databricks App for previewing.

```bash
# From the root of apps/warehouse360
databricks apps deploy warehouse360
```
