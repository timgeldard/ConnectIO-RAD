---
name: DDD refactor — envmon
description: envmon DDD refactor: two bounded contexts, DAL extraction, domain layer, spatial aggregate value objects
type: project
---

envmon backend was refactored from a flat routers/ directory to DDD-structured bounded contexts.

**Why:** User wants to tighten up the repo with DDD. envmon is the proving ground before propagating to spc and trace2.

**Structure created:**
- `backend/inspection_analysis/` — read context (gold-layer queries)
  - `dal/` — plants, heatmap, lots, trends DAL functions
  - `domain/` — risk.py (calculate_risk_score), status.py (derive_location_status, lot_status), spc.py (detect_early_warning)
  - `router.py` — all inspection read endpoints
- `backend/spatial_config/` — write context (app-managed spatial tables)
  - `dal/` — floors, coordinates, plant_geo DAL functions
  - `domain/` — LocationCoordinate value object (validates x/y 0–100%), PlantGeo value object (validates WGS-84)
  - `router.py` — all spatial admin endpoints

**Key decisions:**
- Deleted old `backend/routers/` directory entirely
- `GET /api/em/floors` lives in inspection_analysis/router.py but calls spatial_config/dal/floors.py (cross-context read is OK)
- No Repository pattern, UoW, or domain events on read paths
- `tbl()` and token handling stay in `utils/db.py` (infrastructure, not domain)
- Tests: 23/23 passing; run with `PYTHONPATH=apps/envmon:libs/shared-db/src:libs/shared-api/src:libs/shared-geo/src uv run --no-sync --package envmon-backend python -m pytest apps/envmon/backend/tests`

**Also done:** Added `em_plant_floor` and `em_plant_geo` to `ai-context/semantic-model/entities.yaml`. Rewrote `apps/envmon/docs/architecture.md`.

**How to apply:** When working on spc or trace2 DDD, follow the same two-context pattern (read context + write context) with same DAL/domain layout.
