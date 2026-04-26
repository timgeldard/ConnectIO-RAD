# SPC API Reference

The `spc` backend provides endpoints for statistical calculations, chart generation, and data export.

## 📍 Base URL
When running locally: `http://localhost:8001/api/spc`

## 🔌 Interactive Documentation
When the backend is running, you can access the interactive Swagger UI at:
`http://localhost:8001/api/docs`

## 🛣️ Endpoints

### Metadata
- `GET /metadata/products`: List available products for SPC analysis.
- `GET /metadata/characteristics/{product_id}`: List quality characteristics for a product.

### Charts
- `POST /charts/control-chart`: Generate data points, averages, and control limits for I-MR, X-bar R/S, etc.
- `POST /charts/capability`: Retrieve capability indices (Cpk, Ppk) and histogram data.
- `POST /charts/multivariate`: Generate Hotelling's T² chart data.

### Analysis & Exclusions
- `POST /analysis/violations`: Get detailed information on rule violations (WECO/Nelson).
- `POST /exclusions`: Retrieve or update data points excluded from calculations.

### Traceability
- `POST /trace/lineage`: Get upstream/downstream material lineage for a specific batch/lot.

### Export
- `POST /export/csv`: Export chart data and analysis results to CSV.

## 📦 Key Request Model (SPC Request)
```json
{
  "product_id": "string",
  "characteristic_id": "string",
  "start_date": "ISO-8601",
  "end_date": "ISO-8601",
  "chart_type": "IMR | XBAR_R | XBAR_S | ...",
  "filters": {
    "plant": "string",
    "lot": "string"
  }
}
```
