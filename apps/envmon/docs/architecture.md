# Environmental Monitoring (envmon) Architecture

The Environmental Monitoring (EM) application provides a spatial visualisation of environmental inspection results across facility floor plans.

## Bounded Contexts

The backend is organised into two bounded contexts that reflect the domain's write/read asymmetry: most of envmon is read-only queries against gold-layer views; the only real transactional surface is the three app-managed spatial tables.

### `inspection_analysis` — Read Context

Owns all queries against gold-layer SAP data. Pure reads — no writes to gold tables ever.

```
backend/inspection_analysis/
├── dal/
│   ├── plants.py    # active plant IDs, geo/metadata lookups, KPI aggregation, floor counts
│   ├── heatmap.py   # coordinate + inspection result join for floor heatmap
│   ├── lots.py      # inspection lots, lot detail, location MICs, location summary lots
│   └── trends.py    # MIC time-series and MIC name discovery
├── domain/
│   ├── risk.py      # calculate_risk_score() — weighted exponential decay
│   ├── status.py    # derive_location_status(), lot_status() — status derivation rules
│   └── spc.py       # detect_early_warning() — SPC monotonic-increase check
└── router.py        # plants, heatmap, locations, location-summary, mics, trends, lots endpoints
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

Owns the three app-managed tables. All writes flow through domain value objects that enforce invariants before any SQL executes.

```
backend/spatial_config/
├── dal/
│   ├── floors.py       # em_plant_floor reads + upsert + delete
│   ├── coordinates.py  # em_location_coordinates reads + upsert + delete
│   └── plant_geo.py    # em_plant_geo reads + upsert
├── domain/
│   ├── coordinate.py   # LocationCoordinate value object (validates x/y 0–100%)
│   └── plant_geo.py    # PlantGeo value object (validates WGS-84 bounds)
└── router.py           # floors POST/DELETE, coordinates CRUD, plant-geo CRUD
```

**Endpoints served:**
- `POST /api/em/floors`, `DELETE /api/em/floors/{id}` — floor admin
- `GET /api/em/coordinates/unmapped` — unmapped location discovery
- `GET /api/em/coordinates/mapped` — mapped locations
- `POST /api/em/coordinates` — coordinate upsert (validates via `LocationCoordinate`)
- `DELETE /api/em/coordinates/{id}` — coordinate removal
- `GET /api/em/plant-geo`, `PUT /api/em/plant-geo/{id}` — geo pin admin (validates via `PlantGeo`)

## Domain Logic

The core domain functions in `inspection_analysis/domain/` are pure functions with zero DB or framework dependencies:

### Risk Score (`domain/risk.py`)

```
S = Σ weight_i × e^(-λ_i × days_i)
```

- `weight = 10.0` for rejected valuations (R/REJ/REJECT), `0.0` for passing
- `λ` is MIC-specific (Listeria: 0.05, ATP: 0.3, APC: 0.2) or the endpoint default
- Produces a score in `[0, ∞)` — higher = more recent or more failures

### Status Derivation (`domain/status.py`)

**Deterministic mode** (no `decay_lambda` query param):
- Latest valuation `R` → `FAIL`, otherwise `PASS`

**Continuous mode** (`decay_lambda` provided):
- Risk ≤ 1.0 → `PASS`
- Risk > 1.0 → `WARNING`
- Risk > 5.0 → `FAIL`
- Any current rejection → hard `FAIL` override

Both modes: SPC early warning elevates `PASS` → `WARNING`.

### SPC Early Warning (`domain/spc.py`)

Flags if the last 3 quantitative results are strictly monotonically increasing (x[n] > x[n-1] > x[n-2]). Leading indicator of a trend toward a limit.

## DAL Pattern

Every SQL string lives exclusively in a `dal/` file. DAL functions:
- Are `async`, accept a `token: str` and typed parameters
- Return `list[dict]` — raw SQL result rows
- Contain no business logic

Routers call DAL → pass results to domain functions → build response schemas. No SQL anywhere outside `dal/`.

## Data Model

| Table | Type | Owner | Purpose |
|---|---|---|---|
| `gold_inspection_lot` | gold (read-only) | SAP pipeline | Inspection lot headers |
| `gold_inspection_point` | gold (read-only) | SAP pipeline | Sample points; FUNCTIONAL_LOCATION maps to floor plan |
| `gold_batch_quality_result_v` | gold (read-only) | SAP pipeline | MIC measurement results |
| `gold_plant` | gold (read-only) | SAP pipeline | Plant master (name, country, city) |
| `em_location_coordinates` | app table | EnvMon admin | func_loc_id → X/Y% on floor SVG |
| `em_plant_floor` | app table | EnvMon admin | Floor definitions + SVG config |
| `em_plant_geo` | app table | EnvMon admin | Plant lat/lon for global map pins |

All gold tables are accessed via `tbl()` using the `{{CATALOG}}` resolver. All three app tables are accessed via their configured env-var overrides (e.g. `EM_COORD_TABLE`).

## Mapping Strategy

Floor plan coordinates are stored as **X/Y percentages** (0–100) relative to the SVG viewport dimensions. This makes markers resolution-independent: the frontend scales `x_pct × svg_width / 100` to get pixel position regardless of screen size.

`LocationCoordinate` in `spatial_config/domain/coordinate.py` enforces this at write time — values outside 0–100 are rejected with a 422 before any SQL executes.

## Frontend

- **Framework:** React 18 + TypeScript + Vite
- **Mapping:** MapLibre GL JS (floor plan heatmap + global plant map)
- **State:** TanStack Query for server cache; React Context (`EMContext`) for navigation/filter state
- **Personas:** 5 views (regional, site, sanitation, auditor, admin) with different default navigation levels
- **i18n:** 13 languages via `i18n/resources.json`

## DDD Layer Boundaries

envmon follows the pragmatic DDD boundary rules documented in `docs/adr/ddd-migration-architecture.md`:

| Layer | Allowed imports | Forbidden imports |
|---|---|---|
| `domain/` | stdlib, `shared-domain` base classes | fastapi, dal, schemas, router, sqlalchemy |
| `application/` | domain, dal, other contexts' application modules | fastapi request/response types, routers |
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
