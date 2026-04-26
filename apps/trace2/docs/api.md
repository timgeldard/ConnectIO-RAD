# trace2 API Reference

The `trace2` backend provides endpoints for high-performance batch and lot traceability.

## 📍 Base URL
When running locally: `http://localhost:8002/api/trace`

## 🔌 Interactive Documentation
When the backend is running, you can access the interactive Swagger UI at:
`http://localhost:8002/api/docs`

## 🛣️ Endpoints

All primary endpoints use the `POST` method to allow for complex filtering and parameter passing.

- `POST /overview`: Get a high-level summary for a specific batch.
- `POST /recall-readiness`: Identify all downstream impacts of a suspect batch.
- `POST /bottom-up`: Get upstream material lineage (inputs).
- `POST /top-down`: Get downstream material lineage (outputs).
- `POST /mass-balance`: Get input/output reconciliation data.
- `POST /quality`: Retrieve quality test results for a batch.
- `POST /production-history`: Get production logs and timing for a batch.
- `POST /batch-compare`: Compare metadata and quality across two or more batches.
- `POST /supplier-risk`: Identify risks associated with the raw material suppliers of a batch.
- `POST /coa`: Get Certificate of Analysis metadata.

## 📦 Request Pattern
Most endpoints expect a payload containing at least a `batch_id` or `lot_id`.

```json
{
  "batch_id": "B123456",
  "plant": "P225",
  "depth": 3,
  "include_quality": true
}
```

## 🔒 Rate Limiting
The API implements rate limiting via `SlowAPI` to prevent over-utilization of the Databricks SQL Warehouse. Limits are applied per-user and per-endpoint.
