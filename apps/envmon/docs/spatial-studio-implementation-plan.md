# EnvMon Spatial Studio â€” Implementation Plan

**File:** `apps/envmon/docs/spatial-studio-implementation-plan.md`
**Last updated:** 2026-05-14 — Slices 9–11 complete

---

## Current state findings

### Repository layout

```
apps/envmon/
â”œâ”€â”€ backend/envmon_backend/
â”‚   â”œâ”€â”€ inspection_analysis/          Read-only analytics bounded context
â”‚   â”‚   â”œâ”€â”€ router.py                 7 GET endpoints
â”‚   â”‚   â”œâ”€â”€ application/queries.py    6 service handlers
â”‚   â”‚   â”œâ”€â”€ domain/                   risk.py, spc.py, status.py, valuation.py, inspection.py
â”‚   â”‚   â””â”€â”€ dal/                      heatmap.py, plants.py, lots.py, trends.py
â”‚   â”œâ”€â”€ spatial_config/               Admin spatial authoring bounded context
â”‚   â”‚   â”œâ”€â”€ router.py                 9 endpoints (floors, coordinates, plant-geo)
â”‚   â”‚   â”œâ”€â”€ application/              commands.py (re-exports), queries.py
â”‚   â”‚   â”œâ”€â”€ domain/                   coordinate.py, plant_geo.py
â”‚   â”‚   â””â”€â”€ dal/                      coordinates.py, floors.py, plant_geo.py
â”‚   â”œâ”€â”€ schemas/em.py                 14 Pydantic request/response models
â”‚   â””â”€â”€ utils/                        em_config.py (table refs), db.py (SQL runner)
â”œâ”€â”€ frontend/src/
â”‚   â”œâ”€â”€ types.ts                      8 interfaces + enums
â”‚   â”œâ”€â”€ api/client.ts                 18 TanStack Query hooks
â”‚   â”œâ”€â”€ context/EMContext.tsx          Global state (view, filters, adminMode)
â”‚   â””â”€â”€ components/
â”‚       â”œâ”€â”€ admin/CoordinateMapper.tsx 1000+ lines; current only admin spatial UI
â”‚       â””â”€â”€ floorplan/                FloorPlan.tsx, Marker.tsx, Tooltip.tsx
â”œâ”€â”€ scripts/migrations/               000â€“003 SQL files
â”‚   â”œâ”€â”€ 001b_create_em_location_coordinates.sql
â”‚   â”œâ”€â”€ 001c_create_em_plant_floor.sql
â”‚   â””â”€â”€ 003_create_em_plant_geo.sql
â”œâ”€â”€ deploy.toml                       6 [[migrations]] entries, UAT + prod targets
â””â”€â”€ docs/                             api.md, architecture.md, setup.md
```

### Existing tables

| Table | Primary key | Key columns |
|-------|-------------|-------------|
| `em_location_coordinates` | (plant_id, func_loc_id) | floor_id, x_pos, y_pos (0â€“100 pct) |
| `em_plant_floor` | (plant_id, floor_id) | floor_name, svg_url, svg_width, svg_height, sort_order |
| `em_plant_geo` | plant_id | lat, lon (WGS-84) |

### Current spatial_config boundary

- Domain: `LocationCoordinate` (frozen dataclass), `PlantGeo` (frozen dataclass)
- DAL: CRUD via `MERGE`/`DELETE` statements, all using `run_sql_async` + `sql_param`
- Application: thin coordinators; `commands.py` is a pure re-export faÃ§ade
- Router: FastAPI, auth via `require_proxy_user`, validates via domain objects
- Table refs: resolved in `utils/em_config.py` via `_quote()` and env var overrides

### Key conventions

1. **Table naming** â€” `em_<noun>` prefix, resolved at module load via `os.environ.get("EM_<TABLE>_TABLE", default)` in `em_config.py`
2. **SQL execution** â€” `run_sql_async(token, sql, params)` + `sql_param(name, value)` in `utils/db.py`
3. **Parameterised queries** â€” named params (`:param_name`), never f-string user values
4. **Migration files** â€” `NNN[a-z]_description.sql`, `CREATE TABLE IF NOT EXISTS`, `${TRACE_CATALOG}.${TRACE_SCHEMA}`, `USING DELTA`, auto-optimize properties; column extension uses `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
5. **deploy.toml** â€” `[[migrations]]` block per file, `warehouse_id_env = "DATABRICKS_WAREHOUSE_ID"`
6. **Architecture guardrails** â€” `tests/test_architecture_boundaries.py` AST-scans all `*/domain/*.py`; must not import `envmon_backend.schemas`, `envmon_backend.utils.db`, `*.dal.*`, `fastapi`, `shared_db`, or `shared_auth`
7. **Frontend** â€” inline styles + CSS variables; TanStack Query; no CSS modules; no heavy UI libs
8. **Test coverage** â€” `pyproject.toml` floor 75%; docstring floor 68%; new code must hold both
9. **DELTA schema evolution** â€” `ALTER TABLE â€¦ ADD COLUMN IF NOT EXISTS` is safe and idempotent; never drop-and-recreate existing tables

---

## Target architecture

```
spatial_config/
â”œâ”€â”€ domain/
â”‚   â”œâ”€â”€ coordinate.py          EXISTING â€” LocationCoordinate value object
â”‚   â”œâ”€â”€ plant_geo.py           EXISTING â€” PlantGeo value object
â”‚   â”œâ”€â”€ geometry.py            NEW (Slice 2) â€” pure geometry functions
â”‚   â”œâ”€â”€ zone.py                NEW (Slice 3) â€” LayoutZone value object
â”‚   â””â”€â”€ revision.py            NEW (Slice 3) â€” LayoutRevision entity
â”œâ”€â”€ application/
â”‚   â”œâ”€â”€ commands.py            EXISTING â€” will grow with new re-exports
â”‚   â”œâ”€â”€ queries.py             EXISTING â€” will grow
â”‚   â”œâ”€â”€ layout_validation.py   NEW (Slice 4)
â”‚   â””â”€â”€ layout_publish.py      NEW (Slice 4)
â”œâ”€â”€ dal/
â”‚   â”œâ”€â”€ coordinates.py         EXISTING â€” will gain zone/revision writes (Slice 3)
â”‚   â”œâ”€â”€ floors.py              EXISTING â€” will gain canvas metadata reads/writes (Slice 3)
â”‚   â”œâ”€â”€ plant_geo.py           EXISTING â€” unchanged
â”‚   â”œâ”€â”€ zones.py               NEW (Slice 3)
â”‚   â””â”€â”€ revisions.py           NEW (Slice 3)
â”œâ”€â”€ router.py                  EXISTING â€” unchanged (existing admin endpoints stay)
â””â”€â”€ studio_router.py           NEW (Slice 5) â€” mounted at /api/em/spatial
```

### Router mount (Slice 5)

`main.py` will register `studio_router` with prefix `/api/em/spatial` in addition to the existing `spatial_router` at `/api/em`. This keeps new Studio endpoints clearly separated from legacy admin endpoints without breaking any existing path.

### Frontend new structure (Slices 6â€“11)

```
frontend/src/
â”œâ”€â”€ types.ts                                EXTEND â€” zone, revision, canvas, validation types
â”œâ”€â”€ api/client.ts                           EXTEND â€” Studio hooks
â””â”€â”€ components/
    â””â”€â”€ admin/
        â”œâ”€â”€ CoordinateMapper.tsx            UNCHANGED throughout (see decision below)
        â””â”€â”€ spatial-studio/
            â”œâ”€â”€ SpatialStudio.tsx           NEW (Slice 7) â€” top-level page
            â”œâ”€â”€ StudioShell.tsx             NEW (Slice 7) â€” left/canvas/right/top layout
            â”œâ”€â”€ HierarchyRail.tsx           NEW (Slice 7) â€” floor/L4/L5 tree
            â”œâ”€â”€ CommandBar.tsx              NEW (Slice 7) â€” mode, zoom, validate, publish buttons
            â”œâ”€â”€ StudioCanvas.tsx            NEW (Slice 8) â€” router between FloorPlanCanvas/GridCanvas
            â”œâ”€â”€ FloorPlanCanvas.tsx         NEW (Slice 8) â€” SVG floor plan + zones + points
            â”œâ”€â”€ GridCanvas.tsx              NEW (Slice 8) â€” configurable grid + zones + points
            â”œâ”€â”€ ZoneLayer.tsx               NEW (Slice 9) â€” renders L4 zones (rect/polygon)
            â”œâ”€â”€ PointLayer.tsx              NEW (Slice 10) â€” renders L5 points + constraints
            â”œâ”€â”€ InspectorPanel.tsx          NEW (Slice 9) â€” right panel for selected object
            â”œâ”€â”€ ValidationPanel.tsx         NEW (Slice 11) â€” blocking errors, warnings, suggestions
            â”œâ”€â”€ PublishDialog.tsx           NEW (Slice 11) â€” reason-for-change + warning text
            â””â”€â”€ hooks/
                â”œâ”€â”€ useStudioState.ts       NEW (Slice 7) â€” authoring mode, selection, dirty flag
                â””â”€â”€ useCanvasInteraction.ts NEW (Slice 9) â€” drag/place/resize pointer events
```

---

## Product decisions

### Spatial Studio vs CoordinateMapper coexistence

**Decision: option (b) â€” Studio is a new admin route; CoordinateMapper.tsx is untouched.**

- CoordinateMapper continues to function as today throughout all slices.
- Spatial Studio is accessed via a new admin route added in Slice 7 (e.g. `/admin/spatial-studio`).
- Slice 12 will evaluate whether CoordinateMapper can be deprecated; no deletion before that.
- Rationale: preserves existing admin workflow with zero regression risk while building the new capability incrementally.

### Historical analytics layout rule

**Historical analytics use the current published layout.**

- Operational heatmap (`/api/em/heatmap`) resolves coordinates from `em_location_coordinates` as today.
- After Studio publishes a layout, the `em_location_coordinates` table reflects the published positions (the existing table remains the authoritative source for the heatmap query).
- `em_layout_revision` records the published layout state for governance, rollback, and audit; it is not joined into any heatmap or trend query.
- Historical views and playback use whatever positions are currently in `em_location_coordinates` â€” not the revision that was active at the time of the original inspection.
- Publishing a new layout can change how past inspection results are spatially displayed. Underlying SAP/gold data is never modified.

This decision is reflected in the publish workflow (Slice 4) and publish UI (Slice 11).

### active_revision_id nullability

`em_plant_floor.active_revision_id` is **nullable** in the Slice 1 migration.

Reason: existing floor rows predate the revision system. Backfilling requires a published revision to exist, which only happens after Studio is deployed and used. Until the first publish for a floor, `active_revision_id` is NULL and the heatmap/analytics continue using the raw coordinate table as today.

### Backfilling parent_zone_id on em_location_coordinates

Existing coordinate rows will have `parent_zone_id = NULL` after the Slice 1 migration. Zone assignment is **not backfilled by migration** â€” it is performed manually via the Spatial Studio authoring flow on first use. This is a deliberate governance choice: a human must consciously assign each L5 to an L4 zone.

### new router file

A new `spatial_config/studio_router.py` is registered in `main.py` with prefix `/api/em/spatial`. This keeps Studio endpoints out of the existing `router.py` (which stays below 250 lines) and makes the URL boundary clear.

---

## Data model

### Migration plan

| # | File | Type | Table | Status |
|---|------|------|-------|--------|
| 000 | `000_create_em_location_coordinates.sql` | CREATE | em_location_coordinates v1 | âœ… Deployed |
| 001a | `001a_drop_em_location_coordinates.sql` | DROP | â€” | âœ… Deployed |
| 001b | `001b_create_em_location_coordinates.sql` | CREATE | em_location_coordinates v2 | âœ… Deployed |
| 001c | `001c_create_em_plant_floor.sql` | CREATE | em_plant_floor | âœ… Deployed |
| 002 | `002_seed_p225_floors.sql` | SEED | em_plant_floor | âœ… Deployed |
| 003 | `003_create_em_plant_geo.sql` | CREATE | em_plant_geo | âœ… Deployed |
| 004 | `004_create_em_layout_revision.sql` | CREATE | em_layout_revision | ðŸ”² Slice 1 |
| 005 | `005_create_em_location_zones.sql` | CREATE | em_location_zones | ðŸ”² Slice 1 |
| 006 | `006_extend_em_plant_floor_canvas.sql` | ALTER | em_plant_floor | ðŸ”² Slice 1 |
| 007 | `007_extend_em_location_coordinates_zones.sql` | ALTER | em_location_coordinates | ðŸ”² Slice 1 |

### New table: `em_layout_revision`

```sql
CREATE TABLE IF NOT EXISTS `${TRACE_CATALOG}`.`${TRACE_SCHEMA}`.`em_layout_revision` (
    revision_id              STRING     NOT NULL,
    plant_id                 STRING     NOT NULL,
    floor_id                 STRING     NOT NULL,
    revision_number          INT        NOT NULL,
    state                    STRING     NOT NULL,  -- 'draft' | 'published' | 'superseded' | 'rolled_back'
    base_revision_id         STRING,               -- revision this draft branched from
    change_reason            STRING,               -- required at publish time
    publish_summary_json     STRING,               -- JSON blob: counts of zones, points, warnings
    validation_summary_json  STRING,               -- JSON blob: last validation result
    created_by               STRING     NOT NULL,
    created_at               TIMESTAMP  NOT NULL,
    published_by             STRING,
    published_at             TIMESTAMP,
    rolled_back_from_revision_id STRING           -- set when state = 'rolled_back'
)
USING DELTA
COMMENT 'EM App: spatial layout revision lifecycle (draft/publish/superseded/rolled_back)'
TBLPROPERTIES (
    'delta.enableChangeDataFeed'       = 'false',
    'delta.autoOptimize.optimizeWrite' = 'true',
    'delta.autoOptimize.autoCompact'   = 'true'
)
```

### New table: `em_location_zones`

```sql
CREATE TABLE IF NOT EXISTS `${TRACE_CATALOG}`.`${TRACE_SCHEMA}`.`em_location_zones` (
    zone_id                  STRING     NOT NULL,
    plant_id                 STRING     NOT NULL,
    floor_id                 STRING     NOT NULL,
    functional_location_id   STRING,               -- L4 SAP functional location
    functional_location_level INT,                 -- expected: 4
    zone_name                STRING     NOT NULL,
    geometry_type            STRING     NOT NULL,  -- 'polygon' | 'rectangle'
    geometry_json            STRING     NOT NULL,  -- canonical geometry (see Data Model section)
    bbox_json                STRING,               -- {"x_min_pct","y_min_pct","x_max_pct","y_max_pct"}
    centroid_x               DOUBLE,
    centroid_y               DOUBLE,
    parent_zone_id           STRING,               -- for nested zones (future use)
    revision_id              STRING     NOT NULL,  -- FK to em_layout_revision
    status                   STRING     NOT NULL,  -- 'draft' | 'published' | 'archived'
    created_by               STRING     NOT NULL,
    created_at               TIMESTAMP  NOT NULL,
    updated_by               STRING     NOT NULL,
    updated_at               TIMESTAMP  NOT NULL
)
USING DELTA
COMMENT 'EM App: L4 spatial zones for spatial studio (rectangles and polygons in pct coordinates)'
TBLPROPERTIES (
    'delta.enableChangeDataFeed'       = 'false',
    'delta.autoOptimize.optimizeWrite' = 'true',
    'delta.autoOptimize.autoCompact'   = 'true'
)
```

### Extension: `em_plant_floor` (ALTER TABLE, Slice 1)

New columns added with `ALTER TABLE â€¦ ADD COLUMN IF NOT EXISTS`:

| Column | Type | Nullable | Default meaning | Notes |
|--------|------|----------|-----------------|-------|
| `canvas_type` | STRING | Yes | `'floor_plan'` for existing rows | `'floor_plan'` or `'grid'` |
| `canvas_width` | DOUBLE | Yes | Derived from `svg_width` where set | Canvas width in canvas_units |
| `canvas_height` | DOUBLE | Yes | Derived from `svg_height` where set | Canvas height in canvas_units |
| `canvas_units` | STRING | Yes | `'pct'` for existing floor-plan rows | `'pct'` or `'px'` |
| `grid_size` | DOUBLE | Yes | NULL | Cell size for grid canvas |
| `scale_value` | DOUBLE | Yes | NULL | Metres per unit |
| `scale_units` | STRING | Yes | NULL | `'m'` or `'ft'` |
| `background_image_url` | STRING | Yes | Same as `svg_url` | Replaces `svg_url` for new authoring |
| `background_image_type` | STRING | Yes | `'svg'` where svg_url set | `'svg'` or `'png'` or `'jpg'` |
| `background_checksum` | STRING | Yes | NULL | SHA-256 of uploaded background |
| `active_revision_id` | STRING | Yes | NULL (NULLABLE; see decision above) | FK to em_layout_revision |

Existing `svg_url`, `svg_width`, `svg_height` columns are **not removed or changed**. They remain the source of truth for the existing CoordinateMapper flow.

### Extension: `em_location_coordinates` (ALTER TABLE, Slice 1)

New columns added with `ALTER TABLE â€¦ ADD COLUMN IF NOT EXISTS`:

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `parent_zone_id` | STRING | Yes | FK to em_location_zones.zone_id |
| `placement_source` | STRING | Yes | `'manual'` / `'copied'` / `'migrated'` / `'imported'` |
| `revision_id` | STRING | Yes | FK to em_layout_revision.revision_id |
| `validation_status` | STRING | Yes | `'ok'` / `'warning'` / `'error'` |
| `validation_messages_json` | STRING | Yes | JSON array of issue descriptions |

Existing rows keep `parent_zone_id = NULL`; no mandatory backfill.

### Geometry JSON formats

**Rectangle** (canonical form stored in `geometry_json`):
```json
{
  "type": "rectangle",
  "x_pct": 10.0,
  "y_pct": 10.0,
  "width_pct": 30.0,
  "height_pct": 20.0
}
```

**Polygon** (canonical form):
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

---

## Backend implementation plan

### em_config.py additions (Slice 1)

Add to `utils/em_config.py`:

```python
ZONE_TBL_NAME     = os.environ.get("EM_ZONE_TABLE",     f"{TRACE_CATALOG}.{TRACE_SCHEMA}.em_location_zones")
REVISION_TBL_NAME = os.environ.get("EM_REVISION_TABLE", f"{TRACE_CATALOG}.{TRACE_SCHEMA}.em_layout_revision")
ZONE_TBL          = _quote(ZONE_TBL_NAME)
REVISION_TBL      = _quote(REVISION_TBL_NAME)
```

### New domain files (Slice 2)

#### `spatial_config/domain/geometry.py`

Pure functions, **no imports from outside stdlib or this module**. Must not import `fastapi`, `envmon_backend.schemas`, `envmon_backend.utils.db`, or any DAL module (enforced by `test_architecture_boundaries.py`).

Functions to implement:
- `point_in_polygon(x: float, y: float, points: list[dict]) -> bool` â€” ray-casting algorithm
- `rectangle_to_points(geo: dict) -> list[dict]` â€” converts rectangle JSON to 4-point list
- `polygon_bbox(points: list[dict]) -> dict` â€” returns `{x_min_pct, y_min_pct, x_max_pct, y_max_pct}`
- `polygon_centroid(points: list[dict]) -> tuple[float, float]` â€” returns `(cx, cy)`
- `canvas_bounds_check(points: list[dict]) -> bool` â€” True if all points in [0,100]Â²
- `is_self_intersecting(points: list[dict]) -> bool` â€” True if any non-adjacent edges cross
- `polygons_overlap(a_points: list[dict], b_points: list[dict]) -> bool` â€” SAT-based overlap
- `normalise_geometry(geo: dict) -> dict` â€” converts rectangle â†’ polygon points for uniform handling

All operate on percentage-based coordinates (`x_pct`, `y_pct` floats in 0â€“100).

#### `spatial_config/domain/zone.py`

```python
@dataclass(frozen=True)
class LayoutZone:
    zone_id: str           # Non-empty
    plant_id: str          # Non-empty
    floor_id: str          # Non-empty
    zone_name: str         # Non-empty
    geometry_type: str     # 'polygon' | 'rectangle'
    geometry_json: str     # Validated JSON string
    revision_id: str       # Non-empty

    # Derived after construction
    def to_points(self) -> list[dict]:  # normalised polygon points
    def bbox(self) -> dict:
    def centroid(self) -> tuple[float, float]:
    def contains_point(self, x_pct: float, y_pct: float) -> bool:
```

#### `spatial_config/domain/revision.py`

```python
@dataclass
class LayoutRevision:
    revision_id: str
    plant_id: str
    floor_id: str
    revision_number: int
    state: str             # 'draft' | 'published' | 'superseded' | 'rolled_back'
    base_revision_id: str | None
    change_reason: str | None
    created_by: str
    created_at: datetime

    def is_publishable(self) -> bool:  # state == 'draft'
    def is_active(self) -> bool:       # state == 'published'
```

### New DAL files (Slice 3)

#### `spatial_config/dal/zones.py`

Functions:
- `fetch_zones(token, plant_id, floor_id, revision_id) -> list[dict]`
- `fetch_zone(token, zone_id) -> list[dict]`
- `upsert_zone(token, zone_id, plant_id, floor_id, func_loc_id, zone_name, geometry_type, geometry_json, bbox_json, centroid_x, centroid_y, revision_id) -> None`
- `delete_draft_zone(token, zone_id, revision_id) -> None` â€” only deletes if revision is draft
- `archive_zones_for_revision(token, revision_id) -> None` â€” marks all draft zones as archived

#### `spatial_config/dal/revisions.py`

Functions:
- `fetch_revision(token, revision_id) -> list[dict]`
- `fetch_revisions(token, plant_id, floor_id, limit=20) -> list[dict]`
- `fetch_active_revision(token, plant_id, floor_id) -> list[dict]` â€” state = 'published', most recent
- `fetch_draft_revision(token, plant_id, floor_id) -> list[dict]` â€” state = 'draft', most recent
- `create_revision(token, revision_id, plant_id, floor_id, revision_number, created_by, base_revision_id) -> None`
- `update_revision_state(token, revision_id, state, published_by, published_at, change_reason, publish_summary_json, validation_summary_json) -> None`

### New application files (Slice 4)

#### `spatial_config/application/layout_validation.py`

```python
@dataclass
class ValidationIssue:
    severity: str   # 'blocking_error' | 'warning' | 'suggestion'
    code: str
    message: str
    subject_id: str | None  # zone_id or func_loc_id where applicable

class ValidationResult:
    issues: list[ValidationIssue]
    blocking_errors: list[ValidationIssue]
    warnings: list[ValidationIssue]
    suggestions: list[ValidationIssue]
    is_publishable: bool  # no blocking_errors

async def validate_draft_layout(token, plant_id, floor_id, revision_id) -> ValidationResult:
    # 1. Load zones and coordinates for this draft revision
    # 2. Run blocking error checks (see validation rules section)
    # 3. Run warning checks
    # 4. Run suggestion checks
    # 5. Return ValidationResult
```

#### `spatial_config/application/layout_publish.py`

```python
async def get_or_create_draft(token, plant_id, floor_id, user_identity) -> LayoutRevision:
    # Returns existing draft or creates a new one, incrementing revision_number

async def publish_layout(token, plant_id, floor_id, revision_id, change_reason, user_identity) -> LayoutRevision:
    # 1. Load draft revision â€” raise if not found or not in 'draft' state
    # 2. Validate â€” raise if blocking errors exist
    # 3. Mark previous published revision as 'superseded'
    # 4. Mark this revision as 'published', record published_by/at, change_reason
    # 5. Update em_plant_floor.active_revision_id = this revision_id
    # 6. Copy draft zone coordinates to em_location_coordinates (updates x_pos, y_pos, parent_zone_id, revision_id)
    # 7. Return published revision

async def rollback_layout(token, plant_id, floor_id, target_revision_id, change_reason, user_identity) -> LayoutRevision:
    # STUB in Slice 4: raise NotImplementedError("Rollback deferred to Slice 12")
    # Model supports it via rolled_back_from_revision_id column

async def get_published_layout(token, plant_id, floor_id) -> dict:
    # Returns: floor metadata + zones + coordinates for the active published revision
    # NOTE: This is the resolver used by operational/historical analytics.
    # Uses current published revision, not time-valid lookup.

async def get_draft_layout(token, plant_id, floor_id) -> dict:
    # Returns: floor metadata + zones + coordinates for the current draft revision
```

### New router: `studio_router.py` (Slice 5)

Registered in `main.py` as:
```python
from envmon_backend.spatial_config.studio_router import router as studio_router
app.include_router(studio_router, prefix="/api/em/spatial")
```

Endpoints:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/floors/{floor_id}/layout` | Published layout (zones + coords for operational use) |
| GET | `/floors/{floor_id}/draft` | Current draft layout for authoring |
| POST | `/floors/{floor_id}/draft` | Create or reset draft (idempotent) |
| POST | `/floors/{floor_id}/zones` | Upsert an L4 zone in draft |
| DELETE | `/floors/{floor_id}/zones/{zone_id}` | Delete a draft zone |
| POST | `/floors/{floor_id}/validate` | Validate draft, returns ValidationResult |
| POST | `/floors/{floor_id}/publish` | Publish draft with `change_reason` body |
| GET | `/floors/{floor_id}/revisions` | List revision history (last 20) |
| POST | `/floors/{floor_id}/rollback` | Rollback to a previous revision (stubbed Slice 4) |

All endpoints require `user: UserIdentity = Depends(require_proxy_user)`.

---

## Frontend implementation plan

### New TypeScript types (Slice 6, extends `types.ts`)

```typescript
export type CanvasType = 'floor_plan' | 'grid';
export type ZoneGeometryType = 'polygon' | 'rectangle';
export type RevisionState = 'draft' | 'published' | 'superseded' | 'rolled_back';
export type ValidationSeverity = 'blocking_error' | 'warning' | 'suggestion';
export type StudioMode = 'structure' | 'place' | 'review';

export interface CanvasMetadata {
  canvasType: CanvasType;
  canvasWidth?: number;
  canvasHeight?: number;
  canvasUnits?: string;
  gridSize?: number;
  backgroundImageUrl?: string;
  backgroundImageType?: string;
}

export interface ZonePoint { x_pct: number; y_pct: number; }
export interface RectangleGeometry { type: 'rectangle'; x_pct: number; y_pct: number; width_pct: number; height_pct: number; }
export interface PolygonGeometry { type: 'polygon'; points: ZonePoint[]; }
export type ZoneGeometry = RectangleGeometry | PolygonGeometry;

export interface LayoutZone {
  zoneId: string;
  plantId: string;
  floorId: string;
  zoneName: string;
  geometryType: ZoneGeometryType;
  geometryJson: ZoneGeometry;
  functionalLocationId?: string;
  revisionId: string;
  status: 'draft' | 'published' | 'archived';
}

export interface LayoutRevision {
  revisionId: string;
  plantId: string;
  floorId: string;
  revisionNumber: number;
  state: RevisionState;
  changeReason?: string;
  createdBy: string;
  createdAt: string;
  publishedBy?: string;
  publishedAt?: string;
}

export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  message: string;
  subjectId?: string;
}

export interface ValidationResult {
  issues: ValidationIssue[];
  isPublishable: boolean;
}

export interface DraftLayout {
  revision: LayoutRevision;
  zones: LayoutZone[];
  coordinates: LocationMeta[];  // existing type, now with parentZoneId
}

export interface PublishedLayout {
  revision: LayoutRevision | null;  // null = no published revision yet
  zones: LayoutZone[];
  coordinates: LocationMeta[];
}
```

### New TanStack Query hooks (Slice 6, extends `api/client.ts`)

```typescript
// Studio layout queries
usePublishedLayout(plantId, floorId)     â†’ PublishedLayout
useDraftLayout(plantId, floorId)         â†’ DraftLayout | null
useRevisions(plantId, floorId)           â†’ LayoutRevision[]

// Studio mutations
useCreateDraft()  â†’ mutate({ plantId, floorId })
useUpsertZone()   â†’ mutate(ZoneUpsertRequest)
useDeleteZone()   â†’ mutate({ floorId, zoneId })
useValidate()     â†’ mutate({ plantId, floorId }) â†’ ValidationResult
usePublish()      â†’ mutate({ plantId, floorId, changeReason })
useRollback()     â†’ mutate({ plantId, floorId, targetRevisionId, changeReason })
```

All queries use 0 staleTime during active authoring to ensure fresh state. The mutation hooks invalidate `draftLayout` and `publishedLayout` query keys on settle.

### Component responsibilities

| Component | Slice | Responsibility |
|-----------|-------|----------------|
| `SpatialStudio.tsx` | 7 | Entry point; reads plantId from EMContext; handles floor selection |
| `StudioShell.tsx` | 7 | Three-column layout: HierarchyRail / StudioCanvas / InspectorPanel + CommandBar |
| `HierarchyRail.tsx` | 7 | Floor list â†’ L4 zone list â†’ L5 point list; click to select |
| `CommandBar.tsx` | 7 | Mode tabs (Structure/Place/Review), zoom controls, validate button, publish button, dirty indicator |
| `StudioCanvas.tsx` | 8 | Routes to FloorPlanCanvas or GridCanvas based on floor.canvasType |
| `FloorPlanCanvas.tsx` | 8 | SVG element with background image, ZoneLayer, PointLayer |
| `GridCanvas.tsx` | 8 | SVG with grid lines, same ZoneLayer/PointLayer as floor plan |
| `ZoneLayer.tsx` | 9 | Renders L4 zones from draftLayout.zones; handles select/move/resize in Structure mode |
| `InspectorPanel.tsx` | 9 | Shows selected zone or point properties; editable fields |
| `PointLayer.tsx` | 10 | Renders L5 points; click-to-place in Place mode; red outline if outside parent zone |
| `ValidationPanel.tsx` | 11 | Lists blocking errors (red), warnings (yellow), suggestions (grey) |
| `PublishDialog.tsx` | 11 | Modal: reason-for-change text input, historical-impact warning, confirm button |
| `useStudioState.ts` | 7 | Local state: activeMode, selectedZoneId, selectedPointId, isDirty |
| `useCanvasInteraction.ts` | 9 | Pointer event handling for drag-to-create, drag-to-move, resize handles |

### Historical impact warning (verbatim, required in PublishDialog)

```
"Publishing this layout will affect how current and historical EnvMon results are
spatially displayed. Inspection result values are unchanged; only their spatial
interpretation may change."
```

---

## Validation rules

### Classification

| Severity | Blocks publish? |
|----------|----------------|
| `blocking_error` | Yes |
| `warning` | No |
| `suggestion` | No |

### Blocking errors

| Code | Description |
|------|-------------|
| `L5_NO_PARENT_ZONE` | L5 point has no parent L4 zone assigned |
| `L5_OUTSIDE_PARENT_ZONE` | L5 point coordinates are outside parent L4 zone polygon |
| `L5_WRONG_FLOOR` | L5 point floor_id differs from parent L4 zone floor_id |
| `L5_WRONG_HIERARCHY` | L5 functional location does not belong to the selected L4 hierarchy branch |
| `L4_POLYGON_OPEN` | L4 polygon points list is empty or fewer than 3 points |
| `L4_SELF_INTERSECTING` | L4 polygon edges self-intersect |
| `L4_OUTSIDE_CANVAS` | L4 geometry has points outside [0,100]Â² canvas bounds |
| `PUBLISH_NO_REASON` | Publish attempted without change_reason |
| `PUBLISH_NO_DRAFT` | Publish attempted with no active draft revision |

### Warnings

| Code | Description |
|------|-------------|
| `L4_ZONES_OVERLAP` | Sibling L4 zones overlap each other |
| `L4_ZONE_NO_CHILDREN` | L4 zone has no L5 children |
| `L5_NEAR_BOUNDARY` | L5 point is within 2% of parent zone boundary |
| `FUNC_LOC_UNMAPPED` | Functional location exists in inspection history but has no L5 coordinate |
| `BACKGROUND_CHANGED` | Background image changed while draft was open (checksum mismatch) |
| `CANVAS_METADATA_INCOMPLETE` | Canvas width/height/type is absent but layout is still renderable |

### Suggestions

| Code | Description |
|------|-------------|
| `SNAP_TO_GRID` | Point is not aligned to nearest grid line |
| `ALIGN_ZONE_EDGE` | Zone edge is not horizontal/vertical (within 1Â° tolerance) |

### Implementation approach

Validation is implemented in `layout_validation.py` (application layer). It calls DAL functions to load zone and coordinate data, then calls pure geometry functions from `geometry.py` (domain layer) for each spatial check. The result is a `ValidationResult` object returned both by the validate endpoint and checked again inside `publish_layout`.

---

## API design

### Studio endpoint details

#### `GET /api/em/spatial/floors/{floor_id}/layout?plant_id=P225`

Returns the current published layout for operational/historical analytics use.
**Resolution rule: always returns the currently active published revision, not a time-valid historical revision.**

Response:
```json
{
  "revision": { "revisionId": "...", "state": "published", ... } | null,
  "zones": [...],
  "coordinates": [...]
}
```
If no published revision exists: `revision: null`, zones and coordinates come from the raw `em_location_coordinates` table (backward-compatible with pre-Studio deployments).

#### `POST /api/em/spatial/floors/{floor_id}/publish`

Body:
```json
{ "plant_id": "P225", "revision_id": "uuid-...", "change_reason": "Added zones for P225-F1" }
```
- Fails with 422 if `change_reason` is null or empty
- Fails with 422 if draft has blocking validation errors
- On success: marks revision as published, updates `active_revision_id` on floor, supersedes previous published revision, copies zone coords to `em_location_coordinates`

### Existing endpoint compatibility

All existing `GET /api/em/heatmap` queries continue to read directly from `em_location_coordinates` (no join to revision tables). The heatmap query is unchanged by this plan. Publishing a new layout implicitly changes heatmap results by updating coordinate rows, but the heatmap endpoint itself does not know about revisions.

---

## Test strategy

### Backend tests (per-slice targets)

**Slice 2 â€” `tests/test_geometry_domain.py`**
- `test_point_in_convex_polygon_interior` â€” inside â†’ True
- `test_point_on_polygon_boundary` â€” on edge â†’ True
- `test_point_outside_polygon` â€” outside â†’ False
- `test_rectangle_to_points_yields_4_corners`
- `test_polygon_bbox_correct`
- `test_polygon_centroid_square`
- `test_canvas_bounds_check_valid`
- `test_canvas_bounds_check_out_of_range`
- `test_self_intersecting_bowtie` â€” butterfly polygon â†’ True
- `test_self_intersecting_square` â€” convex â†’ False
- `test_polygons_overlap_touching` â€” touching at edge
- `test_polygons_overlap_separated` â€” False

**Slice 3 â€” extend `tests/test_coordinates_dal.py`**
- `test_upsert_zone_builds_correct_merge`
- `test_delete_draft_zone_sql`
- `test_fetch_zones_filters_by_revision`
- `test_create_revision_sql`
- `test_fetch_active_revision_filter`

**Slice 4 â€” `tests/test_layout_validation.py`**
- `test_validate_l5_outside_zone_is_blocking_error`
- `test_validate_l5_inside_zone_ok`
- `test_validate_no_reason_blocks_publish`
- `test_validate_passes_with_only_warnings`
- `test_overlapping_zones_is_warning_not_blocking`

**Slice 4 â€” `tests/test_layout_publish.py`**
- `test_publish_without_reason_raises`
- `test_publish_with_blocking_errors_raises`
- `test_publish_success_marks_previous_superseded`
- `test_publish_updates_floor_active_revision_id`

**Slice 5 â€” extend `tests/test_routers.py`**
- `test_get_layout_returns_200`
- `test_get_draft_when_no_draft_returns_none`
- `test_publish_without_reason_returns_422`
- `test_validate_endpoint_returns_result`

**Architecture boundary** â€” the existing `test_architecture_boundaries.py` will automatically scan new `*/domain/*.py` files. New `geometry.py`, `zone.py`, and `revision.py` must stay import-clean.

### Frontend tests

**Slice 6 â€” `api/__tests__/client_extended.test.tsx`**
- Extend with hook smoke tests for `usePublishedLayout`, `useDraftLayout`, `usePublish`

**Slice 7 â€” `components/admin/spatial-studio/__tests__/SpatialStudio.test.tsx`**
- Renders without crash
- Shows floor selector when no floor selected
- Changes mode on CommandBar click

**Slice 11 â€” `PublishDialog.test.tsx`**
- Shows historical impact warning text verbatim
- Disabled when no change_reason
- Calls publish mutation on confirm

### Manual test checklist (Slice 12)

1. Open existing EnvMon heatmap â€” confirm markers still render
2. Navigate to Spatial Studio via admin route
3. Select a floor; confirm canvas renders (floor plan or grid placeholder)
4. Create L4 zone via Structure mode
5. Place L5 point inside L4 zone via Place mode â€” confirm green state
6. Attempt to move L5 outside L4 zone â€” confirm red outline / validation error
7. Click Validate â€” confirm issues panel populates
8. Click Publish with no reason â€” confirm blocked
9. Click Publish with blocking error â€” confirm blocked
10. Click Publish with valid layout and reason â€” confirm success
11. Open heatmap for same floor â€” confirm coordinates now reflect published zones
12. Change date range on heatmap â€” confirm same coordinates used (no time-valid lookup)
13. Open Revisions list â€” confirm published revision appears
14. Open CoordinateMapper â€” confirm still functions unchanged
15. Confirm `em_layout_revision` has a 'published' row after step 10

---

## Slice plan

### Slice 0 â€” Discovery and implementation plan
**Status:** âœ… Complete
**Owner/agent:** claude-sonnet-4-6 (this session)
**Files changed:**
- `apps/envmon/docs/spatial-studio-implementation-plan.md` (created)

**Summary:** Explored the full EnvMon app. Documented current state, table schemas, conventions, existing patterns. Committed all architectural decisions. Created this plan.

**Validation performed:** No code changes; plan document review only.

**Open issues:**
- See Open Questions section below before starting Slice 1

---

### Slice 1 â€” Data model migrations and config
**Status:** ðŸ”² Not started
**Owner/agent:** â€”
**Files to create/change:**
- `apps/envmon/scripts/migrations/004_create_em_layout_revision.sql`
- `apps/envmon/scripts/migrations/005_create_em_location_zones.sql`
- `apps/envmon/scripts/migrations/006_extend_em_plant_floor_canvas.sql`
- `apps/envmon/scripts/migrations/007_extend_em_location_coordinates_zones.sql`
- `apps/envmon/deploy.toml` â€” add 4 new `[[migrations]]` blocks
- `apps/envmon/backend/envmon_backend/utils/em_config.py` â€” add `ZONE_TBL`, `REVISION_TBL`

**Summary:** â€”
**Validation performed:** â€”
**Open issues:** â€”

---

### Slice 2 â€” Backend domain geometry and validation primitives
**Status:** ðŸ”² Not started
**Owner/agent:** â€”
**Files to create/change:**
- `apps/envmon/backend/envmon_backend/spatial_config/domain/geometry.py` (new)
- `apps/envmon/backend/tests/test_geometry_domain.py` (new)

**Summary:** â€”
**Validation performed:** â€”
**Open issues:** â€”

---

### Slice 3 â€” Backend DAL and schemas for zones/revisions
**Status:** ðŸ”² Not started
**Owner/agent:** â€”
**Files to create/change:**
- `apps/envmon/backend/envmon_backend/spatial_config/domain/zone.py` (new)
- `apps/envmon/backend/envmon_backend/spatial_config/domain/revision.py` (new)
- `apps/envmon/backend/envmon_backend/spatial_config/dal/zones.py` (new)
- `apps/envmon/backend/envmon_backend/spatial_config/dal/revisions.py` (new)
- `apps/envmon/backend/envmon_backend/spatial_config/dal/coordinates.py` (extend â€” new writes with zone/revision columns)
- `apps/envmon/backend/envmon_backend/spatial_config/dal/floors.py` (extend â€” read/write canvas metadata)
- `apps/envmon/backend/envmon_backend/schemas/em.py` (extend â€” new Studio schemas)
- `apps/envmon/backend/tests/test_coordinates_dal.py` (extend)

**Summary:** â€”
**Validation performed:** â€”
**Open issues:** â€”

---

### Slice 4 â€” Backend layout validation and publish workflow
**Status:** ðŸ”² Not started
**Owner/agent:** â€”
**Files to create/change:**
- `apps/envmon/backend/envmon_backend/spatial_config/application/layout_validation.py` (new)
- `apps/envmon/backend/envmon_backend/spatial_config/application/layout_publish.py` (new)
- `apps/envmon/backend/envmon_backend/spatial_config/application/commands.py` (extend â€” add new re-exports)
- `apps/envmon/backend/envmon_backend/spatial_config/application/queries.py` (extend â€” add layout reads)
- `apps/envmon/backend/tests/test_layout_validation.py` (new)
- `apps/envmon/backend/tests/test_layout_publish.py` (new)

**Summary:** â€”
**Validation performed:** â€”
**Open issues:** â€”

---

### Slice 5 â€” Backend API endpoints
**Status:** ðŸ”² Not started
**Owner/agent:** â€”
**Files to create/change:**
- `apps/envmon/backend/envmon_backend/spatial_config/studio_router.py` (new)
- `apps/envmon/backend/envmon_backend/main.py` (extend â€” register studio_router)
- `apps/envmon/backend/tests/test_routers.py` (extend)
- `apps/envmon/docs/api.md` (update â€” add new Studio endpoints)

**Summary:** â€”
**Validation performed:** â€”
**Open issues:** â€”

---

### Slice 6 â€” Frontend API hooks and types
**Status:** ðŸ”² Not started
**Owner/agent:** â€”
**Files to create/change:**
- `apps/envmon/frontend/src/types.ts` (extend â€” Studio types)
- `apps/envmon/frontend/src/api/client.ts` (extend â€” Studio hooks)
- `apps/envmon/frontend/src/api/__tests__/client_extended.test.tsx` (extend)

**Summary:** â€”
**Validation performed:** â€”
**Open issues:** â€”

---

### Slice 7 â€” Spatial Studio shell UI
**Status:** âœ… Complete
**Owner/agent:** Claude (claude/elegant-elbakyan-44fb23)
**Files to create/change:**
- `apps/envmon/frontend/src/components/admin/spatial-studio/SpatialStudio.tsx` (new)
- `apps/envmon/frontend/src/components/admin/spatial-studio/StudioShell.tsx` (new)
- `apps/envmon/frontend/src/components/admin/spatial-studio/HierarchyRail.tsx` (new)
- `apps/envmon/frontend/src/components/admin/spatial-studio/CommandBar.tsx` (new)
- `apps/envmon/frontend/src/components/admin/spatial-studio/hooks/useStudioState.ts` (new)
- `apps/envmon/frontend/src/context/EMContext.tsx` (extended â€” added `spatialStudioOpen` state + `setSpatialStudioOpen` action)
- `apps/envmon/frontend/src/components/layout/AppShell.tsx` (wired SpatialStudio into admin routing; added Spatial Studio toggle button)
- `apps/envmon/frontend/src/components/admin/spatial-studio/__tests__/SpatialStudio.test.tsx` (new â€” 3 tests)

**Summary:** Floor-selector grid â†’ StudioShell (HierarchyRail + canvas placeholder + inspector placeholder) wired behind a "Spatial Studio" toggle button in the admin top bar. CommandBar provides mode tabs, validate, and publish with inline PublishDialog. Canvas and InspectorPanel are stubs until Slices 8â€“9.
**Validation performed:** 3/3 Vitest tests pass; 77/77 backend tests pass (no-cov).
**Open issues:** â€”

---

### Slice 8 â€” Canvas rendering: floor plan and grid
**Status:** âœ… Complete
**Owner/agent:** Claude (claude/elegant-elbakyan-44fb23)
**Files to create/change:**
- `apps/envmon/frontend/src/components/admin/spatial-studio/StudioCanvas.tsx` (new)
- `apps/envmon/frontend/src/components/admin/spatial-studio/FloorPlanCanvas.tsx` (new)
- `apps/envmon/frontend/src/components/admin/spatial-studio/GridCanvas.tsx` (new)
- `apps/envmon/frontend/src/components/admin/spatial-studio/StudioShell.tsx` (extended â€” `floor: FloorInfo` prop, canvas placeholder replaced with `<StudioCanvas>`)
- `apps/envmon/frontend/src/components/admin/spatial-studio/SpatialStudio.tsx` (extended â€” finds selected floor, passes to StudioShell)
- `apps/envmon/frontend/src/components/admin/spatial-studio/__tests__/SpatialStudio.test.tsx` (updated â€” testid `studio-canvas-placeholder` â†’ `studio-canvas`)

**Summary:** `StudioCanvas` routes to `FloorPlanCanvas` (SVG background image + overlay) or `GridCanvas` (procedural grid lines) based on whether the floor has an `svg_url`. Both canvases follow the same coordinate convention as the existing `FloorPlan` viewer: `viewBox="0 0 viewWidth viewHeight"` with zone percentages scaled to pixels. When no draft is open, both canvases render a centred "Open draft" overlay. Pan/zoom and ZoneLayer/PointLayer are deferred to Slices 9â€“10. `canvas_type` column routing deferred until Slice 1 migrations propagate to the API.

**Validation performed:** 3/3 Vitest tests pass (`SpatialStudio.test.tsx`).
**Open issues:** â€”

---

### Slice 9 â€” L4 zone authoring
**Status:** ðŸ”² Not started
**Owner/agent:** â€”
**Files to create/change:**
- `apps/envmon/frontend/src/components/admin/spatial-studio/ZoneLayer.tsx` (new)
- `apps/envmon/frontend/src/components/admin/spatial-studio/InspectorPanel.tsx` (new)
- `apps/envmon/frontend/src/components/admin/spatial-studio/hooks/useCanvasInteraction.ts` (new)

**Summary:** â€”
**Validation performed:** â€”
**Open issues:** â€”

---

### Slice 10 â€” L5 constrained placement
**Status:** ðŸ”² Not started
**Owner/agent:** â€”
**Files to create/change:**
- `apps/envmon/frontend/src/components/admin/spatial-studio/PointLayer.tsx` (new)

**Summary:** â€”
**Validation performed:** â€”
**Open issues:** â€”

---

### Slice 11 â€” Review mode and publish UX
**Status:** ðŸ”² Not started
**Owner/agent:** â€”
**Files to create/change:**
- `apps/envmon/frontend/src/components/admin/spatial-studio/ValidationPanel.tsx` (new)
- `apps/envmon/frontend/src/components/admin/spatial-studio/PublishDialog.tsx` (new)
- `apps/envmon/frontend/src/components/admin/spatial-studio/__tests__/PublishDialog.test.tsx` (new)

**Summary:** â€”
**Validation performed:** â€”
**Open issues:** â€”

---

### Slice 12 â€” Regression, cleanup, tests, and documentation
**Status:** ðŸ”² Not started
**Owner/agent:** â€”
**Files to create/change:**
- `apps/envmon/docs/architecture.md` (update)
- `apps/envmon/docs/api.md` (update)
- `apps/envmon/docs/spatial-studio-implementation-plan.md` (completion log)
- All backend tests â€” ensure 75% coverage
- Evaluate CoordinateMapper deprecation (do not delete unless explicitly confirmed by user)

**Summary:** â€”
**Validation performed:** â€”
**Open issues:** â€”

---

## Completion log

*(Slices 0, 7–11 complete; Slices 1–6 and 12 pending.)*

- 2026-05-13 â€” Slice 0 completed â€” Discovery and implementation plan. All conventions documented, decisions committed, file map complete.
- 2026-05-14 — Slices 9–11 completed — ZoneLayer, PointLayer, useCanvasInteraction, ValidationPanel, PublishDialog, InspectorPanel, StudioShell updates + tests.

---

## Open questions

These questions require user decisions before or during execution:

1. **L4 polygon authoring in Slice 9**: Should the first implementation support rectangle-only zones, or also free-form polygon vertex placement? Rectangles are much simpler to implement; polygons require vertex drag handles. *Recommended: rectangles in Slice 9, polygon as Slice 9 stretch goal.*

2. **Rollback in Slice 4**: The table model supports rollback via `rolled_back_from_revision_id`. Should the full reverse-publish workflow be implemented in Slice 4, or only stubbed (raise `NotImplementedError`) with a dedicated follow-on slice? *Recommended: stub in Slice 4, full implementation deferred.*

3. **Grid canvas coordinate units**: Should the grid canvas use the same percentage-coordinate model as the floor-plan canvas (x_pct, y_pct in [0,100]), or absolute cell coordinates (column, row integers)? Percentage coordinates allow the same zone/point model across both canvas types. *Recommended: percentage, keeping one unified spatial model.*

4. **Background image hosting**: The spec adds a `background_image_url` field to `em_plant_floor`. For the initial implementation, should this field simply mirror the existing `svg_url` field, or does it require a new upload capability (uploading images to Databricks Volumes or another store)? *Recommend: mirror svg_url for Slice 1; defer upload capability to a future slice.*

5. **L5 parent-zone requirement strictness**: The blocking error `L5_NO_PARENT_ZONE` fires when an L5 has no parent zone. Should this be blocking from day one, or only a warning until all zones are fully mapped? If blocking from day one, the first publish of any floor with unzoned existing coordinates will fail. *Recommended: treat as a warning in early slices, upgrade to blocking only after a migration period is agreed.*

6. **CoordinateMapper entry point**: Should the Spatial Studio be accessible from a new button inside CoordinateMapper, or from a separate admin navigation tab? *Recommended: new button inside CoordinateMapper for now (minimal nav change), with a dedicated nav item in Slice 12 if appropriate.*

7. **Existing uncommitted changes in this worktree**: At the time Slice 0 was written, this worktree also contains uncommitted changes from a separate session (CQ Lab Board fixes, build.py changes, dashboard bindings alignment). These should be committed to a separate branch or PR before starting Slice 1 to keep commits and reviews clean.

---

## Known limitations

- Rollback is modelled but not implemented beyond Slice 4 stub.
- `background_checksum` column is added in Slice 1 but populated only when image upload capability is added (future work).
- `parent_zone_id` on existing `em_location_coordinates` rows will be NULL until manually assigned via Studio; this is by governance design.
- `L5_WRONG_HIERARCHY` validation (L5 functional location not in L4 hierarchy branch) requires knowledge of the SAP functional location hierarchy. This tree is not currently available in the gold layer; the validation check may need to be deferred or simplified to a name-prefix check.
- Polygon overlap detection uses a simplified SAT (Separating Axis Theorem) approach; concave polygon overlap is not perfectly handled but is sufficient for rectangular indoor zones.
- Grid canvas does not support background images in the first implementation (only procedurally rendered grid lines).

---

## Handoff notes for next agent

### What is complete
- Slice 0: Full discovery, all conventions documented, all decisions made, file map created.
- No functional code has been changed.

### What is next (Slice 1)
Start with these four migration files and one config file:

1. **`apps/envmon/scripts/migrations/004_create_em_layout_revision.sql`** â€” `CREATE TABLE IF NOT EXISTS` with the schema in the Data Model section above. Follow the exact pattern of `003_create_em_plant_geo.sql`.
2. **`apps/envmon/scripts/migrations/005_create_em_location_zones.sql`** â€” Same pattern.
3. **`apps/envmon/scripts/migrations/006_extend_em_plant_floor_canvas.sql`** â€” Series of `ALTER TABLE â€¦ ADD COLUMN IF NOT EXISTS` statements for the 11 new canvas columns listed above. Do NOT drop or recreate the existing table.
4. **`apps/envmon/scripts/migrations/007_extend_em_location_coordinates_zones.sql`** â€” `ALTER TABLE â€¦ ADD COLUMN IF NOT EXISTS` for the 5 new columns listed above.
5. **`apps/envmon/deploy.toml`** â€” Add four new `[[migrations]]` blocks after the existing `em_plant_geo` entry. Follow the exact format of existing blocks.
6. **`apps/envmon/backend/envmon_backend/utils/em_config.py`** â€” Add `ZONE_TBL_NAME`, `REVISION_TBL_NAME`, `ZONE_TBL`, `REVISION_TBL` following the exact pattern of existing entries.

### How to run tests/build after Slice 1
```bash
# From apps/envmon/backend/
python -m pytest tests/ -q

# Check migrations are syntactically valid (if Databricks CLI available):
# python3 ../../scripts/deploy_app.py --app-dir . --profile uat --run-migrations --dry-run
```

### Key files to read before starting any slice
1. `apps/envmon/backend/envmon_backend/utils/em_config.py` â€” understand table ref pattern
2. `apps/envmon/scripts/migrations/003_create_em_plant_geo.sql` â€” migration template
3. `apps/envmon/deploy.toml` â€” migration registration pattern
4. `apps/envmon/backend/tests/test_architecture_boundaries.py` â€” boundaries that new domain files must respect

### Partial implementation risks
- `active_revision_id` on `em_plant_floor` is nullable. The heatmap/analytics endpoints do NOT join to this column. Zero risk of breaking live analytics during migration.
- New columns on `em_location_coordinates` are all nullable. Existing MERGE statements in `coordinates.py` do not write these columns; they will remain NULL until Studio explicitly sets them. Zero regression risk.
- The `studio_router.py` is a completely new router at a new path prefix. The existing `router.py` is not modified in Slices 1â€“5. Zero regression risk on existing admin endpoints.
