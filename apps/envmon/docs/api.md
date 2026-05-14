# envmon API Reference

The `envmon` backend is built with FastAPI and provides endpoints for retrieving environmental monitoring data, floor plans, coordinate mappings, and Spatial Studio layout authoring.

## Base URL
When running locally: `http://localhost:8000/api/em`
When deployed on Databricks: `https://<databricks-instance>/apps/envmon/api/em`

## Interactive Documentation
When the backend is running, you can access the interactive Swagger UI at:
`http://localhost:8000/api/docs`

## Authentication

All endpoints require the Databricks Apps proxy to forward the user identity via `x-forwarded-access-token`. In local development a Personal Access Token (PAT) can be supplied instead.

---

## Analytics Endpoints

### Plants
- `GET /plants` — Portfolio KPIs; list of plants with inspection counts
- `GET /plants/{plant_id}` — Detailed metadata for a specific plant

### Floors
- `GET /floors/{plant_id}` — List all floor plans for a plant
- `GET /floors/{plant_id}/{floor_id}/image` — Retrieve the floor plan image (SVG/PNG)

### Heatmap and Trends
- `POST /heatmap` — Aggregated health scores and coordinates for a plant/floor/time range
- `POST /trends` — Historical inspection result trends for specific locations

### Locations
- `GET /locations` — Functional location list
- `GET /locations/{id}/summary` — Location detail with inspection history

### MICs
- `GET /mics` — Distinct MIC (microbiological indicator) names for a plant

### Lots
- `GET /lots/{plant_id}` — Recent production lots

---

## Legacy Admin Endpoints

These endpoints back the existing `CoordinateMapper` admin UI and remain unchanged.

### Coordinates
- `GET /coordinates/unmapped` — Inspection points not yet mapped to a floor
- `GET /coordinates/mapped` — Inspection points with coordinates
- `POST /coordinates` — Save or update X/Y coordinates for an inspection point
- `DELETE /coordinates/{id}` — Remove a coordinate mapping

### Floors (admin)
- `POST /floors` — Create a new floor definition
- `DELETE /floors/{id}` — Remove a floor

### Plant Geo
- `GET /plant-geo` — Plant lat/lon pins
- `PUT /plant-geo/{id}` — Update a plant geo pin

---

## Spatial Studio Endpoints

Base path: `/api/em/spatial`

All Studio endpoints require `plant_id` as a query parameter unless it is part of the URL.

### Published Layout

#### `GET /spatial/floors/{floor_id}/layout?plant_id=P225`

Returns the current published layout for operational and historical analytics use.

**Resolution rule:** always returns the currently active published revision. Historical analytics use this same layout — there is no time-valid revision lookup.

Response:
```json
{
  "revision": {
    "revision_id": "uuid",
    "plant_id": "P225",
    "floor_id": "F1",
    "revision_number": 3,
    "state": "published",
    "change_reason": "Added Zone A for new production line",
    "created_by": "user@example.com",
    "created_at": "2026-05-14T10:00:00Z",
    "published_by": "user@example.com",
    "published_at": "2026-05-14T10:05:00Z"
  },
  "zones": [...],
  "coordinates": [...]
}
```

If no published revision exists, `revision` is `null` and `coordinates` come from the raw `em_location_coordinates` table (backward-compatible with pre-Studio deployments).

---

### Draft Layout

#### `GET /spatial/floors/{floor_id}/draft?plant_id=P225`

Returns the current draft layout for authoring. Returns `null` if no draft exists.

#### `POST /spatial/floors/{floor_id}/draft`

Create or return the current draft revision. Idempotent — if a draft already exists, returns it unchanged.

Body:
```json
{ "plant_id": "P225" }
```

Response: the `DraftLayout` object (revision + zones + coordinates).

---

### Zones

#### `POST /spatial/floors/{floor_id}/zones`

Upsert an L4 zone in the current draft.

Body:
```json
{
  "plant_id": "P225",
  "revision_id": "uuid",
  "zone_id": "uuid",
  "zone_name": "Zone A",
  "geometry_type": "rectangle",
  "geometry_json": {
    "type": "rectangle",
    "x_pct": 10.0,
    "y_pct": 10.0,
    "width_pct": 30.0,
    "height_pct": 20.0
  }
}
```

Returns the created/updated zone.

#### `DELETE /spatial/floors/{floor_id}/zones/{zone_id}?plant_id=P225&revision_id=uuid`

Delete a zone from the current draft. Only draft zones can be deleted.

---

### Validation

#### `POST /spatial/floors/{floor_id}/validate`

Validate the current draft layout. Returns a `ValidationResult` without modifying any state.

Body:
```json
{ "plant_id": "P225", "revision_id": "uuid" }
```

Response:
```json
{
  "issues": [
    {
      "severity": "blocking_error",
      "code": "L5_OUTSIDE_PARENT_ZONE",
      "message": "L5 point P225-F1-SW-001 is outside its parent zone Zone A",
      "subject_id": "zone-uuid"
    }
  ],
  "is_publishable": false
}
```

Severity values: `blocking_error` (must fix before publishing), `warning` (informational), `suggestion` (optional).

---

### Publish

#### `POST /spatial/floors/{floor_id}/publish`

Publish the current draft. Fails with 422 if `change_reason` is missing or if blocking validation errors exist.

Body:
```json
{
  "plant_id": "P225",
  "revision_id": "uuid",
  "change_reason": "Added zones for new production line on floor F1"
}
```

On success:
1. Draft revision is marked `published`
2. Previous published revision (if any) is marked `superseded`
3. `em_plant_floor.active_revision_id` is updated
4. Zone coordinates are copied into `em_location_coordinates` (updates the live heatmap)

Response: the published `LayoutRevision`.

---

### Revision History

#### `GET /spatial/floors/{floor_id}/revisions?plant_id=P225`

Returns the last 20 revisions for the floor, most recent first.

---

### Rollback (stub)

#### `POST /spatial/floors/{floor_id}/rollback`

Not yet implemented. Returns 501 Not Implemented. The data model supports rollback via `rolled_back_from_revision_id`; full implementation is deferred.

---

## Data Models

### LayoutZone
```json
{
  "zone_id": "uuid",
  "plant_id": "P225",
  "floor_id": "F1",
  "zone_name": "Zone A",
  "geometry_type": "rectangle",
  "geometry_json": {
    "type": "rectangle",
    "x_pct": 10.0,
    "y_pct": 10.0,
    "width_pct": 30.0,
    "height_pct": 20.0
  },
  "functional_location_id": "P225-F1-L4-001",
  "revision_id": "uuid",
  "status": "draft"
}
```

Polygon geometry variant:
```json
{
  "type": "polygon",
  "points": [
    {"x_pct": 10.0, "y_pct": 10.0},
    {"x_pct": 40.0, "y_pct": 10.0},
    {"x_pct": 40.0, "y_pct": 30.0},
    {"x_pct": 10.0, "y_pct": 30.0}
  ]
}
```

### ValidationIssue
```json
{
  "severity": "blocking_error | warning | suggestion",
  "code": "L5_OUTSIDE_PARENT_ZONE",
  "message": "Human-readable description",
  "subject_id": "zone-uuid or null"
}
```

### Coordinate Point (legacy)
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
