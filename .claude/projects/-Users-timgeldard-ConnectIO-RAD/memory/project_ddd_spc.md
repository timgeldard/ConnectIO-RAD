---
name: DDD refactor — spc
description: SPC app DDD refactor completed — two bounded contexts, DAL, domain layer, value objects; 290/290 tests, 91.8% coverage
type: project
---

SPC DDD refactor is complete as of 2026-05-04 (commits 8668326, d23a2d0 on main).

**Why:** Follow the same two-context pattern proven with envmon to tighten domain boundaries and make pure math independently testable.

**What was done:**
- Phase A: Extracted pure domain functions (control charts, capability indices, Nelson rules, MSA, Hotelling T²) into `process_control/domain/`.
- Phase B: Restructured into two bounded contexts:
  - `process_control/` — read context (gold views, materialised views); DAL + domain + 3 routers
  - `chart_config/` — write context (spc_locked_limits, spc_exclusions); DAL + domain + 1 router
- Deleted all flat `dal/` and `routers/` files (12 files removed).
- Added 20 new domain value object unit tests (`test_chart_config_domain.py`).
- Rewrote `docs/ARCHITECTURE.md` to document bounded contexts, domain functions, and value object invariants.

**Result:** 290/290 tests passing, 91.8% coverage (up from ~74% before dead files were removed).

**How to apply:** When extending SPC — add reads to `process_control/`, add chart-config writes to `chart_config/`. Pure math goes in `domain/`, SQL in `dal/`, FastAPI wiring in `router*.py`.
