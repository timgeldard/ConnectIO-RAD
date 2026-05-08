# warehouse360 API Reference

The `warehouse360` backend serves the React frontend and live warehouse operation endpoints.

## 📍 Base URL
When running locally: `http://localhost:8003`

## 🔌 Interactive Documentation
When the backend is running, you can access the interactive Swagger UI at:
`http://localhost:8003/api/docs`

## 🛣️ Endpoints

### Static Files
- `GET /`: Serves the `index.html` of the compiled frontend.
- `GET /assets/*`: Serves static assets (images, fonts, scripts).

### Live Endpoints
The backend exposes Databricks-backed API routes for:
- **Control Tower:** Operational KPIs and readiness.
- **Inbound/Outbound:** Receipts, deliveries, and production staging.
- **Inventory:** Bins, line-side stock, plant scope, and IM/WM reconciliation.
- **Dispensary:** Weighing and dispensing work queues.
