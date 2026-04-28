# API Reference

## Current endpoints

```
GET  /api/health
GET  /api/ready
POST /api/orders                    list orders + optional plant_id filter
GET  /api/orders/{id}               full order detail (phases, movements, inspections, QM)
POST /api/pours/analytics           pour analytics: 30-day daily + 24h hourly series + event breakdown
```

`/api/health` and `/api/ready` come from `shared_api`. `/api/health` returns a
static liveness payload; `/api/ready` verifies warehouse config is present.

### `POST /api/orders`

Request body (all fields optional):

```json
{ "plant_id": "P001", "limit": 2000 }
```

Response:

```json
{
  "total": 42,
  "orders": [
    {
      "process_order_id": "...", "inspection_lot_id": "...",
      "material_id": "...", "material_name": "...", "material_category": "...",
      "plant_id": "...", "status": "running|completed|onhold|cancelled|released",
      "start_ms": 1700000000000, "duration_h": 4.5,
      "actual_qty": 250.0, "qty_uom": "KG"
    }
  ]
}
```

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

`materials` is derived server-side from movement_type=261 rows (no extra query).
`time_summary` is derived from the phases list.

### `POST /api/pours/analytics`

Request body (all fields optional):

```json
{ "plant_id": "P001" }
```

`plant_id` filters the scheduled-order count (silver table). Movement queries are
scoped by the app's `POH_CATALOG`/`POH_SCHEMA` views.

Response:

```json
{
  "now_ms": 1700000000000,
  "planned_24h": 42,
  "lines": ["MIX-04", "SPD-02"],
  "events_24h": [
    {
      "material_name": "...", "quantity": 250.0, "uom": "KG",
      "source_area": "...", "operator": "...",
      "ts_ms": 1699913600000, "utc_hour": 10, "shift": "A",
      "line_id": "MIX-04"
    }
  ],
  "daily30d": {
    "ALL":    [ { "date": 1697328000000, "actual": 15, "target": null, "planned": null } ],
    "MIX-04": [ { "date": 1697328000000, "actual": 8,  "target": null, "planned": null } ]
  },
  "hourly24h": {
    "ALL":    [ { "hour": 1699910400000, "actual": 3, "target": null } ],
    "MIX-04": [ { "hour": 1699910400000, "actual": 3, "target": null } ]
  }
}
```

- `events_24h` — movement type-261 events from the last 24 hours, enriched with
  `line_id` from `silver.silver_process_order` and `shift` derived from UTC hour.
- `planned_24h` — count of `silver_process_order` rows with `SCHEDULED_START` in
  the last 24 hours (filterable by `plant_id`).
- `target` — always `null`; no capacity ceiling data source exists.
- `daily30d` / `hourly24h` — pre-aggregated zero-padded series keyed by line ID
  plus the `"ALL"` aggregate. 30 daily buckets (UTC midnight); 24 hourly buckets.
- Shift bucketing assumes UTC timestamps; per-plant timezone correction is a
  known follow-up.

## Future endpoints

```
POST /api/orders/{id}/coa           certificate of analysis bundle
POST /api/planning                  24h slots per line + backlog
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
