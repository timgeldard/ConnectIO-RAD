# Promoting `shared-db` to First-Class API Surface — Detailed Plan

**Owner:** Platform / Data-Access guild  
**Status:** **COMPLETE** — all six slices delivered 2026-05-14–2026-05-15.  
**Effort:** ~3 sprints (Slices 1A–1F below), each independently shippable  
**Depends on:** Slice 4 of `docs/REVIEW.md` (consolidation of `utils/db.py` wrappers) — this plan **subsumes and extends** that slice.  
**Linked findings:** BE-01, BE-02, BE-05, LIB-01, LIB-08, SEC-05  
**ADR:** [`docs/adr/007-shared-db-as-canonical-data-access.md`](adr/007-shared-db-as-canonical-data-access.md)

---

## 1. Goal

Make `libs/shared-db` the **only sanctioned path from Python code to Databricks SQL**. After this work:

1. No backend, library, or script may `import databricks` directly. Every call goes through `shared_db.run_sql_async()` (or its `large` / `write` variants).
2. The library publishes a documented, versioned, semver-stable public API surface, an OpenAPI-equivalent reference (`docs/shared-db.md`), and a "first-call" tutorial.
3. The four extras currently scattered across per-app `utils/db.py` wrappers — **tiered cache, query-audit hook, concurrency semaphore, freshness probe** — live inside `shared-db` and are opt-in flags on the canonical entry points.
4. An importlinter contract fails CI on any direct `databricks` import outside `shared-db`.
5. Docstring (`interrogate`) and branch coverage gates ratchet up to ≥75 % inside this slice.

---

## 2. Current state (as of `main` @ `6106010`)

`libs/shared-db/src/shared_db/__init__.py` already exports a substantial public surface (`run_sql`, `run_sql_async`, `run_sql_large`, `run_sql_large_async`, `tbl`, `sql_param`, `resolve_token`, `SqlRuntime`, `CachePolicy`, `CacheTier`, `DataFreshnessRuntime`, `QueryBuilder`, `fetch_authorized_plants`, `assert_plant_authorized`, the error helpers).

**But there are 6 per-app wrappers that re-export or extend it**, and 2 of them still import `databricks` as a fallback:

| App | Wrapper | Lines | Extras over shared-db | Direct `databricks` import |
|---|---|---:|---|---|
| `spc` | `apps/spc/backend/spc_backend/utils/db.py` | 408 | Tiered cache (`CachePolicy.manufacturing`), query-audit hook (`spc_query_audit` table), exclusions insert | **yes** (`utils/db.py:58`) |
| `envmon` | `apps/envmon/backend/envmon_backend/utils/db.py` | 136 | thin re-export + cache wiring | **yes** (`utils/db.py:42`) |
| `trace2` | `apps/trace2/backend/trace2_backend/utils/db.py` | 159 | `asyncio.Semaphore` concurrency limit, freshness wiring | no (uses `shared_db.executors._sql_executor`) |
| `warehouse360` | `apps/warehouse360/backend/warehouse360_backend/utils/db.py` | 116 | thin re-export | no |
| `connectedquality` | `apps/connectedquality/backend/connectedquality_backend/db.py` | 58 | `asyncio.Semaphore` | no |
| `processorderhistory` | `apps/processorderhistory/backend/processorderhistory_backend/db.py` | 149 | freshness + audit subset | no |

Total per-app wrapper code: **1026 LOC**. Target post-consolidation: **≤ 0 LOC per app** (each wrapper becomes a single-line re-export of `shared_db` or is deleted outright; app-specific persistence like `spc_query_audit` writes become app-owned DAL modules that *call* `shared_db`).

Reaching into private executor internals from app code is also live: `trace2/.../utils/db.py:54` imports `shared_db.executors._sql_executor` (private name).

---

## 3. Public API contract (target shape)

The post-work `shared_db` public surface, fully versioned and documented. Anything not listed becomes private (underscore-prefixed) and unsupported.

### 3.1 Identifiers & config

```python
from shared_db import (
    DATABRICKS_HOST, WAREHOUSE_HTTP_PATH, TRACE_CATALOG, TRACE_SCHEMA,
    hostname, tbl, silver_tbl, check_warehouse_config, resolve_token,
)
```

- `tbl(name)` — canonical table reference; reads `TRACE_CATALOG`/`TRACE_SCHEMA` at call time. Stays the only way to render `<catalog>.<schema>.<table>` in SQL strings.
- `silver_tbl(name)` — promoted as a peer of `tbl` so the semantic-model governance test can keep enforcing it.
- `check_warehouse_config()` — raises `WarehouseNotConfiguredError` if env vars are missing. **Must be called from every app factory readiness probe.**

### 3.2 Execution

```python
from shared_db import (
    run_sql,                 # sync (legacy / scripts only)
    run_sql_async,           # async; the canonical FastAPI handler call
    run_sql_large_async,     # async; EXTERNAL_LINKS disposition for >10 MB results
    sql_param,               # typed parameter binding helper
)
```

New keyword arguments on `run_sql_async` (back-compat additive; existing callers don't change):

| kwarg | Purpose | Default | Replaces per-app extra |
|---|---|---|---|
| `cache_tier: CacheTier \| None` | tiered TTL cache lookup/store | `None` (no cache) | SPC tiered cache, envmon ad-hoc TTL |
| `concurrency_key: str \| None` | gates calls through an `asyncio.Semaphore` keyed by string | `None` | trace2 + CQ semaphore |
| `audit: bool \| AuditHook` | emit a row into `<app>_query_audit` via a registered hook | `False` | SPC `record_query_audit` |
| `endpoint_hint: str` | label propagated to logs, audit hook, metrics | `""` | already present in SPC wrapper |
| `request_id: str \| None` | correlation id propagation | derived from contextvar | inconsistent today |

A new top-level helper for `IN (…)` clauses (closes BE-05):

```python
from shared_db import run_sql_in
rows = await run_sql_in(
    token,
    "SELECT * FROM {plant_table} WHERE plant_id IN ({placeholders})",
    plant_table=tbl("gold_plant"),
    in_param="plant_id",
    values=plant_ids,           # validated len <= 1000, items typed
)
```

### 3.3 Runtime objects (advanced)

```python
from shared_db import (
    SqlRuntime, CachePolicy, CacheTier,
    DataFreshnessRuntime,
    QueryBuilder,
    fetch_authorized_plants, assert_plant_authorized,
)
```

- `SqlRuntime` instances stay constructable so individual apps can keep custom `CachePolicy`s, but the **default singleton** exposed by `run_sql_async` covers 90 % of callers.
- `DataFreshnessRuntime` documented as the only sanctioned way to attach freshness metadata to responses.
- `QueryBuilder` documented with an explicit "for read-only gold-view queries; do not concat into write statements" warning.

### 3.4 Errors & observability

```python
from shared_db import (
    WarehouseNotConfiguredError,
    classify_sql_runtime_error,
    increment_observability_counter,
    send_operational_alert,
)
```

- `classify_sql_runtime_error` becomes the only sanctioned mapper to `HTTPException`. App code that catches a `databricks-sql-connector` exception today is broken once direct imports are banned.

### 3.5 Anti-API (explicitly **not** exported)

- `shared_db.executors._sql_executor` — private. The fact that `trace2/.../utils/db.py:54` imports it is a contract violation that this plan fixes.
- Any `databricks.sql` symbol — apps must not reach for connector internals.

---

## 4. Slice plan

Six slices. Each ends with `npm run check:repo`, the relevant `nx affected -t test`, an interrogate ratchet step, and a `TODO.md` row update.

### Slice 1A — Public surface freeze & docs (½ sprint)

**Objective:** lock the API shape *before* consolidating callers, so the per-app migrations target a stable surface.

| Step | Files |
|---|---|
| Audit every symbol re-exported by `apps/*/backend/.../utils/db.py` and `apps/*/backend/.../db.py`; produce a coverage matrix (`docs/shared-db-migration-matrix.md`) of "app symbol → shared_db symbol → mapping" | new file |
| Add explicit `__all__` to every `shared_db` submodule; underscore-prefix anything not in `__all__` | `libs/shared-db/src/shared_db/*.py` |
| Move `_sql_executor` to a dedicated private module path; introduce a public `shared_db.run_in_sql_executor(callable)` helper for the legitimate trace2 use case (sync work needing the same thread pool) | `libs/shared-db/src/shared_db/executors.py`, `runtime.py` |
| Write `docs/shared-db.md` — the public reference. Sections: **Quick Start**, **API Reference**, **Cache Tiers**, **Concurrency Keys**, **Query Audit**, **EXTERNAL_LINKS**, **Freshness Metadata**, **Authorized Scope**, **Migration Guide**, **Anti-Patterns** | new file |
| Add a one-page **app-facing tutorial** `docs/shared-db-quickstart.md` with a copy-paste-ready FastAPI router snippet | new file |
| Update `ARCHITECTURE.md` shared-libs table row to mark `shared-db` as the **canonical data-access surface** | `ARCHITECTURE.md` |
| Add a CHANGELOG.md to `libs/shared-db/` and seed it with `v1.0.0 — frozen public surface` | new file |
| Bump `libs/shared-db/pyproject.toml` version to 1.0.0; wire it into `scripts/check_wheel_versions.py` PACKAGES list | `libs/shared-db/pyproject.toml`, `scripts/check_wheel_versions.py` |

**Exit:** `docs/shared-db.md` published; CHANGELOG + version bump; no behaviour change.

### Slice 1B — Add the four missing primitives (1 sprint)

**Objective:** land the keyword arguments and helpers that per-app wrappers compensate for today.

| Step | Files |
|---|---|
| **Tiered cache**: hoist SPC's `CachePolicy.manufacturing()` and per-statement tiering into `shared_db.runtime.SqlRuntime`; expose `cache_tier=` kwarg on `run_sql_async`. Two reference policies shipped: `manufacturing` (metadata 15 m, kpi 5 m, transactional 0) and `realtime` (no cache). Document cache-key derivation including the statement+params hash and an explicit `cache_namespace` (mitigates LIB-08) | `libs/shared-db/src/shared_db/runtime.py`, `core.py` |
| **Concurrency key**: add `_SEMAPHORE_REGISTRY: dict[str, asyncio.Semaphore]` lazily initialised from `SQL_CONCURRENCY_LIMIT_<KEY>` env vars with `SQL_CONCURRENCY_LIMIT` fallback; expose `concurrency_key=` kwarg | `libs/shared-db/src/shared_db/runtime.py` |
| **Query-audit hook**: define a `QueryAuditHook` Protocol with `async record(*, endpoint_hint, statement, params, user_token_hash, elapsed_ms, rows, error) -> None`; expose `register_audit_hook(hook)` and `audit=True/False` kwarg. Default hook = no-op. SPC will register `spc_query_audit` writer in its own DAL (Slice 1D) | `libs/shared-db/src/shared_db/runtime.py` (new `audit.py`) |
| **IN-clause helper**: implement `run_sql_in(...)` per §3.2; validate `len(values) <= 1000`, reject non-scalar items, render `:p0,:p1,...` bindings | `libs/shared-db/src/shared_db/core.py` |
| Add `freshness.attach(payload, statement, params, token)` as a sugar over `DataFreshnessRuntime` so apps don't reach for the runtime directly | `libs/shared-db/src/shared_db/freshness.py` |
| Unit tests for every new kwarg / helper — hit the cache hit, cache miss, semaphore contention, audit hook fired, audit hook raises (must be swallowed without affecting the SQL call), IN-helper rejecting oversize lists | `libs/shared-db/tests/test_runtime.py`, `tests/test_audit.py` (new), `tests/test_in_helper.py` (new) |
| Ratchet `libs/shared-db/pyproject.toml [tool.interrogate] fail-under` from **32 → 55** in this slice; from **55 → 75** by Slice 1D | `libs/shared-db/pyproject.toml` |

**Exit:** all four primitives covered by tests; `interrogate` floor at 55; no app code changes yet.

### Slice 1C — Importlinter contract & lint enforcement (½ sprint)

**Objective:** make any future regression mechanical to catch.

Add a new contract to `.importlinter`:

```ini
[importlinter:contract:databricks-sql-only-via-shared-db]
name = Direct databricks SQL imports forbidden outside shared-db
type = forbidden
allow_indirect_imports = True
source_modules =
    connectedquality_backend
    envmon_backend
    processorderhistory_backend
    spc_backend
    template_backend
    trace2_backend
    warehouse360_backend
    shared_api
    shared_auth
    shared_ddd
    shared_manufacturing
    shared_geo
    shared_trace
forbidden_modules =
    databricks
    databricks.sql
ignore_imports =
    # shared_api.health needs the connector to render a readiness payload.
    # The dependency is encapsulated in a single module.
    shared_api.health -> databricks
```

| Step | Files |
|---|---|
| Add the contract above; ensure CI surfaces a clean failure when an app re-introduces `from databricks import sql` | `.importlinter` |
| Add a `ruff` custom rule (or a small `scripts/tests/test_no_direct_databricks_import.py`) that scans for string-level `from databricks` and `import databricks` patterns inside `apps/*/backend` and `libs/shared-{api,auth,ddd,manufacturing,geo,trace}` and asserts none exist — defence in depth against `importlib`-based bypasses | new file under `scripts/tests/` |
| Document the contract in `docs/shared-db.md` "Anti-Patterns" section | `docs/shared-db.md` |
| **Important:** at this point the contract intentionally **does not yet pass** — SPC and envmon still import `databricks` as a fallback. Mark the contract `ignore_imports` for those two specific lines, with a TODO comment referencing this plan; remove them in Slice 1D/1E | `.importlinter` |

**Exit:** new contract added (currently with 2 ignores); CI fails on any *new* direct databricks import.

### Slice 1D — Migrate SPC and envmon off direct imports (1 sprint)

**Objective:** delete the last two `from databricks import sql` lines in app code.

| Step | Files |
|---|---|
| Replace SPC `utils/db.py` runtime construction with `run_sql_async(..., cache_tier=..., audit=True, concurrency_key="spc")`; move the legacy `run_sql` fallback (lines 58, 162–169) to call `shared_db.run_sql` | `apps/spc/backend/spc_backend/utils/db.py` |
| Move SPC's `record_query_audit`/`spc_query_audit` writer into a dedicated DAL module `apps/spc/backend/spc_backend/process_control/dal/query_audit.py` that registers itself via `shared_db.register_audit_hook` at app-startup | new file + edit `apps/spc/backend/spc_backend/main.py` |
| Hoist SPC's `record_exclusions_insert` (`utils/db.py:394-408`) into `apps/spc/backend/spc_backend/process_control/dal/exclusions.py` (this code is domain-specific writes, not a generic primitive) | new file |
| Reduce `apps/spc/backend/spc_backend/utils/db.py` to a re-export shim (or delete it entirely and update imports) | edits across SPC backend |
| Mirror the same migration for `apps/envmon/backend/envmon_backend/utils/db.py`: delete the `databricks_sql` fallback (line 42), point all callers at `shared_db.run_sql_async` with the right `cache_tier` | `apps/envmon/backend/envmon_backend/utils/db.py` and call sites |
| Remove the two `ignore_imports` lines in `.importlinter` added in Slice 1C | `.importlinter` |
| Add an `assert_plant_authorized`-style helper for envmon's f-string `IN` clause (BE-05) using the new `run_sql_in` | `apps/envmon/backend/envmon_backend/spatial_config/dal/plants.py` |
| Ratchet `interrogate` floors: `shared-db` 55 → 75, `spc-backend` 40 → 55, `envmon-backend` 68 → 75 | per `pyproject.toml` |
| Add a CI step that asserts `grep -rE "from databricks( |\.)|import databricks" apps/ libs/shared-{auth,ddd,manufacturing,geo,trace}` returns no hits | `.github/workflows/ci.yml` |

**Exit:** zero direct `databricks` imports outside `shared-db` and `shared-api.health`; SPC + envmon test suites green; importlinter passes with no ignores.

### Slice 1E — Consolidate the remaining four wrappers (1 sprint)

**Objective:** delete `utils/db.py` / `db.py` per-app modules where they no longer earn their keep.

| Step | Files |
|---|---|
| `apps/trace2/backend/trace2_backend/utils/db.py` (159 LOC): stop importing `_sql_executor` (private); use new `shared_db.run_in_sql_executor`; concurrency moves to `concurrency_key="trace2"`; freshness moves to `shared_db.freshness.attach` | edit + delete most of the module |
| `apps/connectedquality/backend/connectedquality_backend/db.py` (58 LOC): replace with a one-line re-export; semaphore → `concurrency_key="cq"` | edit |
| `apps/processorderhistory/backend/processorderhistory_backend/db.py` (149 LOC): freshness + audit subset migrates to `shared_db` hooks; module becomes thin re-export | edit |
| `apps/warehouse360/backend/warehouse360_backend/utils/db.py` (116 LOC): already thin; collapse to one-line re-export | edit |
| Update all `from <app>.utils.db import ...` callers to `from shared_db import ...` directly; the per-app modules can stay as legacy import shims for one release with a `DeprecationWarning`, then delete in Slice 1F | grep + sed across `apps/*/backend/` |
| Add a governance test `scripts/tests/test_dal_uses_shared_db.py` asserting every `apps/*/backend/.../dal/*.py` imports from `shared_db` and not from a sibling `utils/db` (locks in the migration) | new file |
| Ratchet `interrogate` floors: `trace2-backend` 57 → 70, `connectedquality-backend` 86 → 90, `processorderhistory-backend` 80 → 90, `warehouse360-backend` 78 → 90 | per `pyproject.toml` |

**Exit:** all six per-app wrappers either deleted or reduced to deprecation shims; DAL governance test enforces the migration; total per-app wrapper LOC < 50 (from 1026).

### Slice 1F — Remove the deprecation shims & finalise (½ sprint)

| Step | Files |
|---|---|
| Delete the deprecation shims left in Slice 1E; remove any final `utils/db.py` modules; update imports | apps/*/backend |
| Add a final importlinter contract: every app's DAL package must depend on `shared_db` (positive contract: `requires`) | `.importlinter` |
| Lock the API: `libs/shared-db/CHANGELOG.md` v1.1.0 entry "removed legacy re-exports; public surface is now frozen" | `libs/shared-db/CHANGELOG.md` |
| Run a full `nx run-many -t test` on every app and lib; capture coverage report; ratchet `--cov-branch` floors per backend from current actuals (typically 50–65) to a uniform 70 % | per `pyproject.toml` |
| Update `CLAUDE.md` "Key Conventions" → "DAL pattern" line to say **"All Databricks SQL goes through `shared_db`. Never `import databricks` directly. See `docs/shared-db.md`."** | `CLAUDE.md` |
| Update `ai-context/rules/backend_rules.md` with the same statement | `ai-context/rules/backend_rules.md` |
| Add an ADR `docs/adr/005-shared-db-as-canonical-data-access.md` documenting the decision, the alternatives considered (per-app DALs, ORM, raw connector), and the migration history | new file |

**Exit:** `shared-db` is unambiguously the only sanctioned path. ADR-005 is the authoritative reference.

---

## 5. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Per-app SqlRuntime instances had subtly different cache TTLs (e.g. SPC tightened metadata to 10 m); collapsing them changes user-visible response freshness | Slice 1B introduces named `CachePolicy` presets, not a single global. Each app explicitly passes a tier name. The migration audit (`docs/shared-db-migration-matrix.md`) records the *exact* TTL per app and locks them in via tests. |
| Audit-hook semantics: SPC's `record_query_audit` writes synchronously inline today; the hook protocol must not block the calling request | Make the hook fire-and-forget via `asyncio.create_task` on a bounded queue; back-pressure rule documented; SPC audit moves to async writer with bounded queue + drop-on-overflow + counter metric. |
| Concurrency-key migration changes parallelism profile under load | Default `concurrency_key=None` (no semaphore), so apps that don't opt in are unchanged. Document tuning per app in `docs/shared-db.md`. |
| Importlinter contract false positives in `shared-api.health` | Explicit `ignore_imports` entry already in the contract; covered by `test_no_direct_databricks_import.py` allow-list. |
| Hidden callers of private symbols (`_sql_executor`, `_sql_cache_lock`, etc.) break silently | Slice 1A's underscore-prefixing change + a deprecation shim with `warnings.warn(..., DeprecationWarning, stacklevel=2)` for one release; CI runs with `-W error::DeprecationWarning` only inside `libs/shared-db/tests` to surface internal regressions while allowing external consumers a transition window. |
| Wheel-bundled platform shell ships an older `shared-db` than the unbundled apps | `scripts/check_wheel_versions.py` already enforces a bump when source changes; extend its `PACKAGES` list to fail when any app's `pyproject.toml` requires a `shared-db` version newer than the wheel-bundled one. |
| Coverage ratchet too aggressive causes flaky CI | Each slice ratchets one step at a time and only after the corresponding migration lands; never ratchet the slice that touches the most code. |

---

## 6. Acceptance criteria (Definition of Done)

A reviewer can verify the work by running the following and getting a green result:

1. `grep -rE "(from|import) databricks(\.|$| )" apps/ libs/shared-{api,auth,ddd,manufacturing,geo,trace}/src/` → only `libs/shared-api/src/shared_api/health.py` matches.
2. `npm run lint:architecture:python` → all importlinter contracts green, **including** `databricks-sql-only-via-shared-db`, with no `ignore_imports` lines for app modules.
3. `uv run pytest scripts/tests/test_no_direct_databricks_import.py scripts/tests/test_dal_uses_shared_db.py` → both pass.
4. `find apps -name "db.py" -path "*/utils/*" -o -name "db.py" -path "*/backend/*"` → returns zero non-test files (or files ≤ 5 LOC, where the only line is a deprecation re-export to be deleted in Slice 1F).
5. `uv tool run interrogate --config libs/shared-db/pyproject.toml libs/shared-db` → ≥ 75 %.
6. `nx run-many -t test` → green across every backend, with `--cov-branch` enforced and floors at the slice-end values.
7. `docs/shared-db.md`, `docs/shared-db-quickstart.md`, `docs/adr/005-shared-db-as-canonical-data-access.md`, and `libs/shared-db/CHANGELOG.md` exist and are linked from `docs/INDEX.md` and `ARCHITECTURE.md`.
8. `databricks bundle validate --target uat` green across all 7 apps (no deployment regression).
9. A new app generated by `tools/generators/bounded-context` and validated by `scripts/validate_new_app.py template` uses `shared_db` exclusively and has no `utils/db.py` template.

---

## 7. Out of scope (explicitly deferred)

- **Streaming large results.** `run_sql_large_async` still buffers full result sets (TODO.md). Streaming is a separate plan.
- **Schema-aware DAL ORM.** This plan keeps the DAL pattern (string SQL + `:param` bindings + `tbl()`); no ORM is introduced.
- **Cross-warehouse routing.** Today only one Databricks SQL warehouse is supported; multi-warehouse fan-out is a later, ADR-driven decision.
- **Connection pooling beyond the existing executor.** The `databricks-sql-connector` already handles HTTP connection reuse; introducing a custom pool is not in scope unless load testing in Slice 1E shows the executor as a bottleneck.

---

## 8. Sequencing summary

```
Slice 1A — Freeze surface + docs              (½ sprint)  ✓ 2026-05-14
Slice 1B — Add 4 primitives + IN-helper       (1 sprint)  ✓ 2026-05-14  ┐
Slice 1C — Importlinter contract              (½ sprint)  ✓ 2026-05-14  │ ran in parallel
Slice 1D — SPC + envmon migration             (1 sprint)  ✓ 2026-05-15  ┘
Slice 1E — Remaining 4 wrappers + DAL gate    (1 sprint)  ✓ 2026-05-15
Slice 1F — ADR-007 + docs mandates + v1.1.0   (½ sprint)  ✓ 2026-05-15
```

Total: ~4 engineer-sprints. Slice 1A unblocks everything else; Slices 1B and 1C can run in parallel because 1B doesn't touch app code and 1C only adds CI gates with temporary ignores. Slices 1D, 1E, 1F are strictly sequential because each consumes the previous slice's deliverable.
