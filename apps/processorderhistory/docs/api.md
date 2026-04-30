# API Reference

## Current endpoints

```
GET  /api/health
GET  /api/ready
GET  /api/me
POST /api/orders                    list orders + optional plant_id filter
GET  /api/orders/{id}               full order detail (phases, movements, inspections, QM)
POST /api/pours/analytics           pour analytics: 30-day daily + 24h hourly series + events
POST /api/yield/analytics           yield analytics: per-order yield, daily 30d, hourly 24h
POST /api/quality/analytics         quality analytics: inspection results, RFT daily/hourly series
POST /api/dayview                   day view: single-day Gantt blocks + downtime
POST /api/planning/schedule         planning board: ±7-day Gantt blocks, backlog, KPIs
POST /api/downtime/analytics        downtime pareto: grouped by reason + daily trend
POST /api/oee/analytics             OEE analytics: weighted trend + per-line performance
POST /api/adherence/analytics       adherence analytics: OTIF rate trend + order list
```

`/api/health` and `/api/ready` come from `shared_api`. `/api/health` returns a
static liveness payload; `/api/ready` verifies warehouse config is present.
Interactive documentation is available at [/docs](/docs).

### `GET /api/me`

No request body.  Returns the authenticated user derived from the
`x-forwarded-access-token` OIDC token:

```json
{ "name": "Alice Smith", "initials": "AS", "email": "alice.smith@example.com" }
```

### `POST /api/yield/analytics`

Request body (all fields optional):

```json
{
  "plant_id": "P001",
  "date_from": "2024-01-01",
  "date_to": "2024-01-07",
  "timezone": "UTC"
}
```

Response:

```json
{
  "now_ms": 1700000000000,
  "target_yield_pct": 95.0,
  "materials": ["Sugar", "Salt"],
  "orders": [
    {
      "process_order_id": "...", "material_id": "...", "material_name": "...",
      "qty_received_kg": 980.5, "qty_issued_kg": 1000.0,
      "yield_pct": 98.05, "loss_kg": 19.5, "order_date_ms": 1700000000000
    }
  ],
  "prior7d": [],
  "daily30d":  [ { "date": 1697328000000, "avg_yield_pct": 96.5 } ],
  "hourly24h": [ { "hour": 1699910400000, "avg_yield_pct": 94.2 } ]
}
```

**Yield Calculation Logic:**
*   **Yield %** = `(qty_received_kg / qty_issued_kg) * 100`
*   **Loss kg** = `qty_issued_kg - qty_received_kg`
*   **Receipts (Received)**: Sum of MT-101 minus MT-102 (reversals).
*   **Issues (Issued)**: Sum of MT-261 minus MT-262 (reversals).
*   UOMs are normalized: `EA` is excluded; `G` is converted to `KG` (/1000).

### `POST /api/orders`

Request body (all fields optional):

```json
{ "plant_id": "P001", "limit": 2000 }
```

`limit` is clamped server-side to [1, 5000].

Response:

```json
{
  "total": 42,
  "orders": [
    {
      "process_order_id": "...", "inspection_lot_id": "...",
      "material_id": "...", "material_name": "...", "material_category": "...",
      "plant_id": "...", "status": "running|completed|onhold|cancelled|released",
      "start_ms": 1700000000000, "end_ms": 1700003600000, "duration_h": 4.5,
      "actual_qty": 250.0, "qty_uom": "KG"
    }
  ]
}
```

`actual_qty` is net MT-101 minus MT-102 in KG; `null` when no receipt movements exist.

### `GET /api/orders/{id}`

Returns `404` if the order does not exist.  Response shape:

```json
{
  "order": { "process_order_id": "...", "status": "...", "raw_status": "...",
             "material_id": "...", "material_name": "...", "material_category": "...",
             "plant_id": "...", "inspection_lot_id": "...", "batch_id": "...",
             "supplier_batch_id": "...", "manufacture_date_ms": 0, "expiry_date_ms": 0 },
  "time_summary":     { "setup_s": 0, "mach_s": 0, "clean_s": 0 },
  "movement_summary": { "qty_issued_kg": 0, "qty_received_kg": 0 },
  "phases":    [ { "phase_id": "...", "phase_description": "...", "phase_text": "...",
                   "operation_quantity": 0, "operation_quantity_uom": "...",
                   "start_user": "...", "end_user": "...",
                   "setup_s": 0, "mach_s": 0, "clean_s": 0 } ],
  "materials": [ { "material_id": "...", "material_name": "...", "batch_id": "...",
                   "total_qty": 0, "uom": "..." } ],
  "movements": [ { "material_id": "...", "material_name": "...", "batch_id": "...",
                   "movement_type": "261", "quantity": 0, "uom": "...",
                   "storage_id": "...", "user_name": "...", "date_time_of_entry": 0 } ],
  "comments":  [ { "created_ms": 0, "sender": "...", "notes": "...", "phase_id": "..." } ],
  "downtime":  [ { "start_time_ms": 0, "duration_s": 0, "reason_code": "...",
                   "sub_reason_code": "...", "issue_type": "...", "issue_title": "...",
                   "operators_comments": "..." } ],
  "equipment": [ { "equipment_type": "...", "instrument_id": "...",
                   "status_from": "...", "status_to": "...", "change_at_ms": 0 } ],
  "inspections": [ { "characteristic_id": "...", "characteristic_description": "...",
                     "sample_id": "...", "specification": "...",
                     "quantitative_result": 0, "qualitative_result": "...",
                     "uom": "...", "judgement": "A" } ],
  "usage_decision": { "usage_decision_code": "...", "valuation_code": "...",
                      "quality_score": 0, "created_by": "...", "created_date_ms": 0 }
}
```

- `materials` is derived server-side from MT-261 rows (no extra query).
- `time_summary` is derived from the phases list.
- `movement_summary` quantities are `null` when no net movement of that type exists.

### `POST /api/pours/analytics`

Request body (all fields optional):

```json
{
  "plant_id": "P001",
  "date_from": "2024-01-01",
  "date_to": "2024-01-07",
  "timezone": "UTC"
}
```

`date_from` / `date_to` omitted → last-24h rolling window.

Response:

```json
{
  "now_ms": 1700000000000,
  "planned_24h": null,
  "lines": [],
  "events": [
    {
      "ts_ms": 1699913600000, "line_id": "ALL",
      "operator": null, "source_area": null, "source_type": null,
      "process_order": null, "quantity": 250.0, "uom": "KG", "shift": null
    }
  ],
  "prior7d": [],
  "daily30d": {
    "ALL": [ { "date": 1697328000000, "actual": 15, "target": null, "planned": null } ]
  },
  "hourly24h": {
    "ALL": [ { "hour": 1699910400000, "actual": 3, "target": null } ]
  }
}
```

- `events` — MT-261 pour events for the requested period.
- `prior7d` — MT-261 events for the 7 days before `date_from` (empty when no date range supplied).
- `planned_24h` — always `null`; planned pour count requires silver schema access not currently available.
- `lines` — always `[]`; per-line attribution is a known follow-up (silver schema access).
- `line_id` — always `"ALL"` for the same reason.
- `shift` — always `null`; shift bucketing is a known follow-up.
- `target` — always `null`; no capacity ceiling data source exists.
- `daily30d` / `hourly24h` — zero-padded series keyed by line ID plus `"ALL"`. 30 daily buckets (local midnight); 24 hourly buckets.

### `POST /api/quality/analytics`

Request body (all fields optional):

```json
{
  "plant_id": "P001",
  "date_from": "2024-01-01",
  "date_to": "2024-01-07",
  "timezone": "UTC"
}
```

`date_from` / `date_to` omitted → last-24h rolling window; `prior7d` is empty.

Response:

```json
{
  "now_ms": 1700000000000,
  "materials": ["Sugar", "Salt"],
  "rows": [
    {
      "process_order": "PO-001", "inspection_lot_id": "...",
      "material_id": "...", "material_name": "...", "plant_id": "P001",
      "characteristic_id": "...", "characteristic_description": "...",
      "sample_id": "...", "specification": "...",
      "quantitative_result": 98.5, "qualitative_result": null,
      "uom": "...", "judgement": "A",
      "result_date_ms": 1700000000000,
      "usage_decision_code": "A", "valuation_code": "GOOD", "quality_score": 95.0
    }
  ],
  "prior7d": [],
  "daily30d":  [ { "date": 1697328000000, "accepted": 42, "rejected": 3, "rft_pct": 93.3 } ],
  "hourly24h": [ { "hour": 1699910400000, "accepted": 5, "rejected": 0, "rft_pct": 100.0 } ]
}
```

- Timestamp is `USAGE_DECISION_CREATED_DATE` — rows without a usage decision are excluded from date-filtered queries.
- `judgement`: `"A"` when `INSPECTION_RESULT_VALUATION` starts with `'A'`, else `"R"`.
- `rft_pct` (right-first-time %) is `null` for zero-result buckets.

### `POST /api/oee/analytics`

Request body (all fields optional):

```json
{
  "plant_id": "P001",
  "date_from": "2024-01-01",
  "date_to": "2024-01-07",
  "timezone": "UTC"
}
```

Response:

```json
{
  "now_ms": 1700000000000,
  "lines": [
    {
      "line_id": "L01",
      "avg_oee_pct": 82.5,
      "avg_availability_pct": 88.0,
      "avg_performance_pct": 95.0,
      "avg_quality_pct": 99.0,
      "total_scheduled_m": 1440.0,
      "total_downtime_m": 172.0,
      "total_units": 1000.0,
      "good_units": 990.0
    }
  ],
  "daily30d": [
    {
      "date": 1697328000000,
      "oee": 82.5,
      "availability": 88.0,
      "performance": 95.0,
      "quality": 99.0
    }
  ]
}
```

### `POST /api/adherence/analytics`

Request body (all fields optional):

```json
{
  "plant_id": "P001",
  "date_from": "2024-01-01",
  "date_to": "2024-01-07",
  "timezone": "UTC"
}
```

Response:

```json
{
  "now_ms": 1700000000000,
  "orders": [
    {
      "order_id": "ORD01",
      "material_id": "MAT01",
      "line_id": "L01",
      "end_ms": 1700000000000,
      "planned_qty": 100.0,
      "confirmed_qty": 100.0,
      "is_on_time": true,
      "is_in_full": true,
      "is_otif": true,
      "delay_days": 0,
      "qty_variance_pct": 0.0
    }
  ],
  "daily30d": [
    {
      "date": 1697328000000,
      "otif_pct": 95.0,
      "on_time_pct": 98.0,
      "in_full_pct": 97.0,
      "order_count": 20
    }
  ]
}
```

### `POST /api/dayview`

Request body (all fields optional):

```json
{ "day": "2024-01-15", "plant_id": "P001" }
```

`day` is ISO date (YYYY-MM-DD); omitting it defaults to today UTC.

Response:

```json
{
  "day": "2024-01-15",
  "day_start_ms": 1705276800000,
  "day_end_ms": 1705363199999,
  "lines": ["LINE-01", "LINE-02"],
  "blocks": [
    {
      "id": "PO-001-LINE-01", "poId": "PO-001", "lineId": "LINE-01",
      "start": 1705300000000, "end": 1705328800000,
      "kind": "running|completed|onhold",
      "label": "...", "sublabel": "...",
      "confirmedQty": 250.0, "plannedQty": 0.0, "uom": "KG"
    }
  ],
  "downtime": [
    {
      "poId": "PO-001", "lineId": "LINE-01",
      "start": 1705310000000, "end": 1705313600000,
      "reasonCode": "...", "issueType": "...", "issueTitle": "..."
    }
  ],
  "kpis": {
    "orderCount": 5, "completedCount": 3,
    "confirmedQty": 1200.5, "downtimeEvents": 2, "downtimeMins": 45.0
  }
}
```

- Only orders with SAP confirmation activity on `day` are included; RELEASED/CREATED/CANCELLED orders are excluded.
- Block start/end derived from `vw_gold_confirmation` MIN/MAX timestamps, clamped to the day boundary.
- `lineId` comes from `silver_process_order.PROCESS_LINE`; falls back to `"UNKNOWN"`.
- `plannedQty` is always `0.0` (no planned quantity in source data).

### `POST /api/planning/schedule`

Request body (all fields optional):

```json
{ "plant_id": "P001" }
```

Response:

```json
{
  "now_ms": 1700000000000,
  "today_ms": 1700000000000,
  "window_start_ms": 1699827200000,
  "window_end_ms": 1700432000000,
  "lines": ["LINE-01"],
  "blocks": [
    {
      "id": "PO-001-LINE-01", "poId": "PO-001", "lineId": "LINE-01",
      "start": 1700000000000, "end": 1700028800000,
      "kind": "running|firm|completed",
      "label": "...", "sublabel": "...",
      "qty": 0, "uom": "KG", "materialId": "...",
      "customer": null, "shift": null, "operator": null, "ratePerH": null,
      "materials": [], "shortageETA": null, "shortageItem": null, "activeDowntime": null
    }
  ],
  "backlog": [
    {
      "id": "bl-PO-002", "poId": "PO-002", "product": "...",
      "materialId": "...", "category": null,
      "qty": 0, "uom": "KG", "due": 1700604800000,
      "priority": "normal", "customer": "—", "requiresLine": "—", "durationH": 8
    }
  ],
  "kpis": {
    "runningCount": 2, "totalLines": 3, "todaysQty": 0, "todaysCount": 4,
    "utilization": 0, "onTimePct": 0, "atRiskCount": 0,
    "materialShortCount": 0, "wmInTransit": 0,
    "downtimeMinsToday": 0, "activeDowntimeCount": 0,
    "backlogCount": 5, "backlogUrgent": 0
  }
}
```

- Window: 2 days back, 5 days forward from now.
- Block `end` = `start + 8 h` (no planned duration in silver schedule table).
- Block `qty` is always `0` (no output quantity in silver schedule table).
- `kind`: `"running"` (in progress), `"completed"`, or `"firm"` (scheduled/on-hold).
- Capacity KPI fields (`utilization`, `onTimePct`, `atRiskCount`) return `0` pending a capacity master data source.
- `lineId` comes from `silver_process_order.PROCESS_LINE`; falls back to `"UNKNOWN"`.

## Future endpoints

```
POST /api/orders/{id}/coa           certificate of analysis bundle
POST /api/pours                     pour event log (filterable by line/date)
POST /api/kpis                      pour target/planned/actual rollup
```

## Auth

Identical to the other apps in the monorepo: the Databricks Apps proxy
forwards the user's OIDC token via `x-forwarded-access-token`. The backend
uses that token to authenticate SQL warehouse queries (no service principal).

## Catalog / schema

`POH_CATALOG` (default `connected_plant_uat`) and `POH_SCHEMA` (default
`csm_process_order_history`) are passed through `app.template.yaml`. SQL helpers
use `tbl()` for the app schema and `silver_tbl()` for `POH_CATALOG.silver.*`.
Both use `:param` placeholders — see `apps/trace2/backend/dal/` for the
canonical pattern.
