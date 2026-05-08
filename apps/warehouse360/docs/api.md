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

The backend exposes Databricks-backed API routes. Concrete paths below;
each is also catalogued in the interactive Swagger UI.

#### Control Tower
- `GET /api/kpis` — operational KPI signals.

#### Inbound / Outbound
- `GET /api/inbound` — pending and recent receipts.
- `GET /api/inbound/{po_id}` — single receipt detail.
- `GET /api/deliveries` — outbound deliveries list.
- `GET /api/deliveries/{delivery_id}` — single delivery detail.
- `GET /api/wh-cockpit` — production-staging order list.
- `GET /api/wh-cockpit/{order_id}` — single order detail.

#### Inventory
- `GET /api/inventory/bins` — bin stock by plant.
- `GET /api/inventory/lineside` — line-side stock by plant.
- `GET /api/plants` — plants visible to the caller.

#### IM/WM reconciliation (IMWM)
All IMWM endpoints accept either `plant=` (cockpit selection) or
`plant_id=` (Warehouse360 cross-app context); `plant` wins when both are
provided. Each response includes `data_freshness` metadata for the
upstream gold view. Capped at 2000 rows in the DAL.
- `GET /api/imwm/stock` — IM vs WM stock comparison.
- `GET /api/imwm/movements` — recent goods-movement activity strip
  (last 200 rows by posting date/time DESC).
- `GET /api/imwm/exceptions` — rule-generated exception queue,
  severity-DESC.
- `GET /api/imwm/analytics/aging` — aged inventory value, bucketed.

#### Dispensary
- `GET /api/dispensary` — weighing and dispensing work queues.
