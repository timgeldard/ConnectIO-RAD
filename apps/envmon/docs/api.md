# envmon API Reference

The `envmon` backend is built with FastAPI and provides endpoints for retrieving environmental monitoring data, floor plans, and coordinate mappings.

## 📍 Base URL
When running locally: `http://localhost:8000/api/em`
When deployed on Databricks: `https://<databricks-instance>/apps/envmon/api/em`

## 🔌 Interactive Documentation
When the backend is running, you can access the interactive Swagger UI at:
`http://localhost:8000/api/docs`

## 🛣️ Endpoints

### Plants
- `GET /plants`: Retrieve a list of facilities (plants) available for monitoring.
- `GET /plants/{plant_id}`: Get detailed metadata for a specific plant.

### Floors
- `GET /floors/{plant_id}`: List all floor plans associated with a specific plant.
- `GET /floors/{plant_id}/{floor_id}/image`: Retrieve the static image (SVG/PNG) for a floor plan.

### Heatmap & Trends
- `POST /heatmap`: Get aggregated health scores and coordinates for a specific plant, floor, and time range.
- `POST /trends`: Retrieve historical inspection result trends for specific locations.

### Coordinates (Admin)
- `GET /coordinates/{plant_id}/{floor_id}`: Retrieve all mapped inspection points for a floor.
- `POST /coordinates`: Save or update the X/Y coordinates for an inspection point.

### Lots
- `GET /lots/{plant_id}`: List recent production lots for context within the monitoring view.

## 🔐 Security
The API uses Databricks-native authentication when deployed. In local development, it can be configured to use a Personal Access Token (PAT) for SQL Warehouse access.

## 📦 Data Models

### Coordinate Point
```json
{
  "location_id": "string",
  "x_percent": 0.0,
  "y_percent": 0.0
}
```

### Heatmap Result
```json
{
  "location_id": "string",
  "health_score": 0.85,
  "result_count": 12,
  "coordinates": {
    "x": 45.2,
    "y": 12.8
  }
}
```
