# ADR-007 — shared-db as the canonical Databricks SQL path

**Status:** Accepted — in production use  
**Date:** 2026-05-15  
**Linked findings:** BE-01, BE-02, BE-05, LIB-01, LIB-08, SEC-05  
**Supersedes:** nothing  
**See also:** `docs/SHARED_DB_PROMOTION_PLAN.md`, `docs/shared-db.md`

---

## Context

All seven apps in this repo access Databricks SQL through the Statement Execution
REST API. Before this ADR, there were **six per-app wrappers** — `utils/db.py` or
`db.py` — totalling 1 026 lines of largely duplicated code. Two wrappers
(`apps/spc` and `apps/envmon`) contained direct `from databricks import sql` fallback
logic. One (`apps/trace2`) imported a private symbol `shared_db.executors._sql_executor`.
The remaining three each reimplemented an `asyncio.Semaphore` concurrency limit.

The risks from this state were:

- **Security:** direct connector imports bypass the REST executor, meaning auth is
  applied inconsistently and rate-limiting / observability hooks may be skipped.
- **Correctness:** each wrapper applied slightly different cache TTLs, semaphore
  limits, and error mappings. A bug fix in one did not propagate to the others.
- **Maintainability:** adding a cross-cutting concern (e.g. request tracing,
  circuit breaking) required editing six files.

`libs/shared-db` already existed as a shared library but its use was not mandatory.

---

## Decision

**`libs/shared-db` is the only sanctioned path from Python application code to
Databricks SQL.** No app backend, shared library, or script may `import databricks`
directly. All SQL execution goes through `shared_db.run_sql_async` (or its variants).

### Enforcement mechanisms

| Mechanism | How it enforces |
|---|---|
| `importlinter` contract `databricks-sql-only-via-shared-db` | Fails CI if any `databricks` import appears outside `shared-db` |
| `scripts/tests/test_no_direct_databricks_import.py` | AST-based defence-in-depth against static `import`/`from` statements; does not catch `importlib.import_module` dynamic imports |
| `scripts/tests/test_dal_uses_shared_db.py` | Asserts DAL files use no direct `databricks` import and no private `shared_db._*` names |

### Public API surface (frozen at v1.0.0, extended at v1.1.0)

```python
from shared_db import (
    # identifiers
    DATABRICKS_HOST, WAREHOUSE_HTTP_PATH, TRACE_CATALOG, TRACE_SCHEMA,
    hostname, tbl, silver_tbl, check_warehouse_config, resolve_token,
    # execution
    run_sql, run_sql_async, run_sql_large_async, sql_param, run_sql_in,
    # runtime objects
    SqlRuntime, SqlRuntimeConfig, CachePolicy, CacheTier,
    DataFreshnessRuntime, QueryBuilder,
    # concurrency
    get_semaphore,
    # executor helpers
    run_in_sql_executor, is_connector_available,
    # auth
    fetch_authorized_plants, assert_plant_authorized,
    # errors
    WarehouseNotConfiguredError, classify_sql_runtime_error,
    increment_observability_counter, send_operational_alert,
)
```

---

## Alternatives considered

### Option A: Keep per-app wrappers, add importlinter only

Only add the `importlinter` contract and AST guard. Let each app continue owning
its wrapper.

**Rejected because** the contract alone does not fix the existing violations (SPC and
envmon had direct `databricks` imports). It also does not reduce the 1 026 LOC
duplication or consolidate the divergent cache/semaphore implementations.

### Option B: ORM (SQLAlchemy + Databricks dialect)

Replace all raw SQL with an ORM layer backed by the Databricks dialect for
SQLAlchemy.

**Rejected because** all queries target read-only gold-layer views with no schema
ownership; the semantic model (joins, CTEs, recursive lineage) maps poorly to ORM
conventions. The SQL Statement API's async REST path is also a natural fit for the
existing DAL pattern and avoids adding a connection-pool concern.

### Option C: Vendored Databricks SDK (databricks-sdk) directly

Use `WorkspaceClient.statement_execution` from `databricks-sdk` in each app, without
an intermediate library.

**Rejected because** it still produces per-app boilerplate for auth, error mapping,
caching, and concurrency. It also does not enforce consistent parameterisation and
is harder to mock in unit tests than the single-function `run_sql_async` interface.

---

## Migration history

The migration was delivered in six slices documented in `docs/SHARED_DB_PROMOTION_PLAN.md`:

| Slice | Description | Status |
|---|---|---|
| 1A | Public surface freeze, `__all__`, docs, CHANGELOG | Complete — 2026-05-14 |
| 1B | `SqlRuntime` tiered cache, `get_semaphore`, `run_sql_in`, freshness helpers | Complete — 2026-05-14 |
| 1C | `importlinter` contract + AST guard test | Complete — 2026-05-14 |
| 1D | SPC and envmon off direct `databricks` imports; audit DAL | Complete — 2026-05-15 |
| 1E | `_sql_executor` removed from 4 app wrappers; all 6 semaphores centralised; DAL governance test | Complete — 2026-05-15 |
| 1F | ADR, CHANGELOG v1.1.0, CLAUDE.md + backend_rules mandates | Complete — 2026-05-15 |

---

## Consequences

### Positive

- Zero direct `databricks` imports in app code; `importlinter` + two AST tests
  enforce this in CI with no manual review step.
- Concurrency limits for all six apps are now controlled through a single registry
  (`get_semaphore(key)`) reading `SQL_CONCURRENCY_LIMIT_<KEY>` env vars.
- `run_in_sql_executor` is the public, documented way to offload blocking SQL-adjacent
  work to the shared thread pool.
- `is_connector_available()` replaces try/except connector import guards in app code.
- Any new cross-cutting concern (circuit breaking, distributed tracing, adaptive
  caching) is added once in `shared_db` and inherited by all apps.

### Negative / trade-offs

- App-specific `_get_sql_executor()` logic in SPC and envmon still imports the private
  `_CONNECTOR_EXECUTOR` / `_REST_EXECUTOR` objects for connector-vs-REST fallback
  selection. These two app-level functions are the only remaining callers of private
  executor symbols; they are candidates for a future `shared_db.get_executor()` helper.
- Per-app `utils/db.py` wrappers still exist as thin app-specific modules (custom
  `tbl()`, schema-env-var reading, audit re-exports). They are now clean of private
  imports and duplicate boilerplate, but they are not zero lines. Full deletion is
  deferred until a new-app template generator is updated (acceptance criterion 9 in
  the promotion plan).

---

## Compliance

This ADR satisfies the following findings from the 2026-04 codebase review:

| Finding | Resolution |
|---|---|
| BE-01: Direct databricks imports bypassing shared layer | Fixed — importlinter contract + AST guard enforce the ban |
| BE-02: Divergent cache TTLs across apps | Fixed — all wrappers use `CachePolicy.manufacturing()` from shared_db |
| BE-05: Unsafe IN-clause construction | Fixed — `run_sql_in` validates and binds values safely |
| LIB-01: shared-db lacks a public API surface | Fixed — `__all__` in every submodule; CHANGELOG at v1.1.0 |
| LIB-08: Cache key namespace collisions | Addressed — cache keys include statement hash + per-runtime namespace |
| SEC-05: Private `_sql_executor` reachable from app code | Fixed — removed from all app imports; `run_in_sql_executor` is the public replacement |
