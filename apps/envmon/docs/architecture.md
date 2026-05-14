# Environmental Monitoring (envmon) Architecture

The Environmental Monitoring (EM) application provides a spatial visualisation of environmental inspection results across facility floor plans, and a Spatial Studio authoring tool for managing floor layouts and zone assignments.

## Bounded Contexts

The backend is organised into two bounded contexts that reflect the domain write/read asymmetry: most of envmon is read-only queries against gold-layer views; the only real transactional surface is the app-managed spatial tables.

### `inspection_analysis` — Read Context

Owns all queries against gold-layer SAP data. Pure reads — no writes to gold tables ever.

```
backend/inspection_analysis/
+-- dal/
|   +-- plants.py    # active plant IDs, geo/metadata lookups, KPI aggregation, floor counts
|   +-- heatmap.py   # coordinate + inspection result join for floor heatmap
|   +-- lots.py      # inspection lots, lot detail, location MICs, location summary lots
|   +-- trends.py    # MIC time-series and MIC name discovery
+-- domain/
|   +-- risk.py      # calculate_risk_score() - weighted exponential decay
|   +-- status.py    # derive_location_status(), lot_status() - status derivation rules
|   +-- spc.py       # detect_early_warning() - SPC monotonic-increase check
+-- router.py        # plants, heatmap, locations, location-summary, mics, trends, lots endpoints
```

**Endpoints served:**
- `GET /api/em/plants` — portfolio KPIs
- `GET /api/em/floors` — floor list (reads spatial_config DAL)
- `GET /api/em/heatmap` — floor plan heatmap
- `GET /api/em/locations` — functional location list
- `GET /api/em/locations/{id}/summary` — location detail
- `GET /api/em/mics` — distinct MIC names
- `GET /api/em/trends` — MIC time-series
- `GET /api/em/lots` — inspection lots
- `GET /api/em/lots/{lot_id}` — lot MIC detail

### `spatial_config` — Write Context

Owns the app-managed spatial tables. All writes flow through domain value objects that enforce invariants before any SQL executes. This context exposes two routers:

- **`router.py`** — legacy CoordinateMapper admin endpoints at `/api/em`
- **`studio_router.py`** — Spatial Studio authoring endpoints at `/api/em/spatial`

```
backend/spatial_config/
+-- dal/
|   +-- floors.py       # em_plant_floor reads + upsert + delete; canvas metadata reads
|   +-- coordinates.py  # em_location_coordinates reads + upsert + delete
|   +-- plant_geo.py    # em_plant_geo reads + upsert
|   +-- zones.py        # em_location_zones CRUD (draft/published/archived lifecycle)
|   +-- revisions.py    # em_layout_revision CRUD (draft to published to superseded)
+-- domain/
|   +-- coordinate.py   # LocationCoordinate value object (validates x/y 0-100%)
|   +-- plant_geo.py    # PlantGeo value object (validates WGS-84 bounds)
|   +-- geometry.py     # Pure geometry functions (ray-casting, SAT overlap, bbox, centroid)
|   +-- zone.py         # LayoutZone value object (geometry validation, contains_point)
|   +-- revision.py     # LayoutRevision entity (draft/published state, publishable check)
+-- application/
|   +-- commands.py          # Re-export facade for command handlers
|   +-- queries.py           # Floor/coordinate read service (used by inspection_analysis)
|   +-- layout_validation.py # Validate draft layout - blocking errors, warnings, suggestions
|   +-- layout_publish.py    # get_or_create_draft, publish_layout, rollback_layout (stubbed)
+-- router.py           # Legacy admin: floors POST/DELETE, coordinates CRUD, plant-geo CRUD
+-- studio_router.py    # Spatial Studio: layout, draft, zones, validate, publish, revisions
```

**Legacy admin endpoints (router.py):**
- `POST /api/em/floors`, `DELETE /api/em/floors/{id}` — floor admin
- `GET /api/em/coordinates/unmapped` — unmapped location discovery
- `GET /api/em/coordinates/mapped` — mapped locations
- `POST /api/em/coordinates` — coordinate upsert (validates via `LocationCoordinate`)
- `DELETE /api/em/coordinates/{id}` — coordinate removal
- `GET /api/em/plant-geo`, `PUT /api/em/plant-geo/{id}` — geo pin admin (validates via `PlantGeo`)

**Studio endpoints (studio_router.py):** see `docs/api.md`.

## Domain Logic

### Risk Score (`domain/risk.py`)

```
S = sum(weight_i * e^(-lambda_i * days_i))
```

- `weight = 10.0` for rejected valuations (R/REJ/REJECT), `0.0` for passing
- lambda is MIC-specific (Listeria: 0.05, ATP: 0.3, APC: 0.2) or the endpoint default
- Produces a score in [0, inf) — higher = more recent or more failures

### Status Derivation (`domain/status.py`)

**Deterministic mode** (no `decay_lambda` query param):
- Latest valuation `R` → `FAIL`, otherwise `PASS`

**Continuous mode** (`decay_lambda` provided):
- Risk <= 1.0 → `PASS`
- Risk > 1.0 → `WARNING`
- Risk > 5.0 → `FAIL`
- Any current rejection → hard `FAIL` override

Both modes: SPC early warning elevates `PASS` → `WARNING`.

### SPC Early Warning (`domain/spc.py`)

Flags if the last 3 quantitative results are strictly monotonically increasing (x[n] > x[n-1] > x[n-2]). Leading indicator of a trend toward a limit.

### Geometry (`domain/geometry.py`)

Pure functions operating on percentage-based coordinates (x_pct, y_pct in [0, 100]):

- `point_in_polygon` — ray-casting algorithm
- `rectangle_to_points` — converts rectangle JSON to 4-point polygon
- `polygon_bbox` / `polygon_centroid` — bounding box and centroid
- `canvas_bounds_check` — all points within [0, 100] squared
- `is_self_intersecting` — detects crossing edges (bowtie polygons)
- `polygons_overlap` — SAT-based overlap detection
- `normalise_geometry` — converts rectangle to polygon points for uniform handling

### Layout Validation (`application/layout_validation.py`)

Produces a `ValidationResult` with `blocking_error`, `warning`, and `suggestion` issues. Blocking errors prevent publishing. Key rules:

| Code | Severity | Description |
|------|----------|-------------|
| `L5_NO_PARENT_ZONE` | blocking | L5 point has no parent L4 zone |
| `L5_OUTSIDE_PARENT_ZONE` | blocking | L5 outside its parent zone polygon |
| `L4_OUTSIDE_CANVAS` | blocking | L4 geometry outside [0, 100] squared |
| `L4_SELF_INTERSECTING` | blocking | L4 polygon self-intersects |
| `L4_ZONES_OVERLAP` | warning | Sibling zones overlap |
| `L4_ZONE_NO_CHILDREN` | warning | L4 zone has no L5 children |

## DAL Pattern

Every SQL string lives exclusively in a `dal/` file. DAL functions:
- Are `async`, accept a `token: str` and typed parameters
- Return `list[dict]` — raw SQL result rows
- Contain no business logic

Routers call DAL -> pass results to domain functions -> build response schemas. No SQL anywhere outside `dal/`.

## Data Model

| Table | Type | Owner | Purpose |
|---|---|---|---|
| `gold_inspection_lot` | gold (read-only) | SAP pipeline | Inspection lot headers |
| `gold_inspection_point` | gold (read-only) | SAP pipeline | Sample points; FUNCTIONAL_LOCATION maps to floor plan |
| `gold_batch_quality_result_v` | gold (read-only) | SAP pipeline | MIC measurement results |
| `gold_plant` | gold (read-only) | SAP pipeline | Plant master (name, country, city) |
| `em_location_coordinates` | app table | EnvMon admin | func_loc_id to X/Y% on floor SVG; gains `parent_zone_id`, `revision_id` columns |
| `em_plant_floor` | app table | EnvMon admin | Floor definitions + SVG config; gains canvas metadata and `active_revision_id` |
| `em_plant_geo` | app table | EnvMon admin | Plant lat/lon for global map pins |
| `em_location_zones` | app table | Spatial Studio | L4 spatial zones (rectangles and polygons in pct coordinates) |
| `em_layout_revision` | app table | Spatial Studio | Layout revision lifecycle (draft to published to superseded) |

All gold tables are accessed via `tbl()` using the `{{CATALOG}}` resolver. All app tables are accessed via their configured env-var overrides (e.g. `EM_COORD_TABLE`, `EM_ZONE_TABLE`, `EM_REVISION_TABLE`).

## Mapping Strategy

Floor plan coordinates are stored as **X/Y percentages** (0-100) relative to the SVG viewport dimensions. This makes markers resolution-independent: the frontend scales `x_pct * svg_width / 100` to get pixel position regardless of screen size.

`LocationCoordinate` in `spatial_config/domain/coordinate.py` enforces this at write time — values outside 0-100 are rejected with a 422 before any SQL executes.

L4 zones are stored in the same percentage coordinate system. `LayoutZone` in `spatial_config/domain/zone.py` enforces geometry validity (minimum vertices, in-bounds, non-self-intersecting) at write time.

## Layout Revision Lifecycle

```
         create_draft()
              |
         +----+------+
         |   draft   | <-- upsert/delete zones and coordinates
         +----+------+
              | publish_layout()
         +----+------+
         | published | -- sets em_plant_floor.active_revision_id
         +----+------+
              | next publish
     +--------+---------+
     |   superseded     |
     +------------------+
```

- Only one revision per floor can be in `draft` state at a time.
- Publishing copies zone positions into `em_location_coordinates` (the authoritative source for heatmap queries).
- Historical analytics use the **currently published** layout, not a time-valid historical revision.
- Rollback is modelled (`rolled_back_from_revision_id` column) but not yet implemented beyond a stub.

## Frontend

- **Framework:** React 18 + TypeScript + Vite
- **Mapping:** MapLibre GL JS (floor plan heatmap + global plant map)
- **State:** TanStack Query for server cache; React Context (`EMContext`) for navigation/filter state
- **Personas:** 5 views (regional, site, sanitation, auditor, admin) with different default navigation levels
- **i18n:** 13 languages via `i18n/resources.json`

### Spatial Studio UI

The Spatial Studio is a new admin route accessible via a "Spatial Studio" toggle button in the admin top bar. It provides a three-column authoring environment:

```
components/admin/spatial-studio/
+-- SpatialStudio.tsx       # Entry point; floor selector grid
+-- StudioShell.tsx         # Three-column layout shell + CommandBar
+-- HierarchyRail.tsx       # Floor/zone/point tree navigation
+-- CommandBar.tsx          # Mode tabs, validate, publish buttons
+-- StudioCanvas.tsx        # Routes to FloorPlanCanvas or GridCanvas
+-- FloorPlanCanvas.tsx     # SVG background + ZoneLayer + PointLayer
+-- GridCanvas.tsx          # Procedural grid + ZoneLayer + PointLayer
+-- ZoneLayer.tsx           # L4 zone rendering + drag-to-create/resize
+-- PointLayer.tsx          # L5 point rendering + click-to-place
+-- InspectorPanel.tsx      # Selected zone/point properties + validation issues
+-- ValidationPanel.tsx     # Grouped blocking errors, warnings, suggestions
+-- PublishDialog.tsx       # Reason-for-change modal with historical-impact warning
+-- hooks/
    +-- useStudioState.ts       # activeMode, selectedZoneId, isDirty
    +-- useCanvasInteraction.ts # Pointer events for drag/place/resize
```

The existing `CoordinateMapper.tsx` is unchanged and continues to function alongside the Spatial Studio.

## DDD Layer Boundaries

envmon follows the pragmatic DDD boundary rules documented in `docs/adr/ddd-migration-architecture.md`:

| Layer | Allowed imports | Forbidden imports |
|---|---|---|
| `domain/` | stdlib, `shared-domain` base classes | fastapi, dal, schemas, router, sqlalchemy |
| `application/` | domain, dal, other contexts application modules | fastapi request/response types, routers |
| `dal/` | db utils, SQL runtime | domain, application |
| `router.py` | application, schemas, rate limit, auth | dal, SQL runtime |

Cross-context access: `inspection_analysis/application/queries.py` imports `spatial_config.application.queries` for coordinate lookups — the only cross-context dependency, and approved because it stays at the application layer.

Architecture guardrail tests at `scripts/tests/test_ddd_architecture_guardrails.py` enforce these rules automatically on every CI run.

## Explicit Non-Goals

- Repository pattern on read paths
- Unit of Work
- Domain events / event sourcing
- Command/query bus
- Splitting inspection_analysis into further sub-contexts (shared gold tables, same query shapes)
- Time-valid layout lookup (historical analytics use the current published layout, not the one active at inspection time)
