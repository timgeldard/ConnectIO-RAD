# shared-db — API Reference

`shared-db` is the **only sanctioned path** from ConnectIO-RAD Python code to
Databricks SQL. Every SQL call in every backend must go through this library.
Direct `from databricks import sql` is forbidden by the `databricks-sql-only-via-shared-db`
importlinter contract (added in Slice 1C of the promotion plan).

**Version:** 1.0.0 (API frozen — see [CHANGELOG](../libs/shared-db/CHANGELOG.md))

---

## Quick Start

```python
from shared_db import tbl, sql_param, run_sql_async, resolve_token

async def get_materials(
    x_forwarded_access_token: str | None,
    authorization: str | None,
) -> list[dict]:
    token = resolve_token(x_forwarded_access_token, authorization)
    rows = await run_sql_async(
        token,
        f"SELECT material_id, description FROM {tbl('gold_material')} LIMIT 100",
        endpoint_hint="materials.list",
    )
    return rows
```

For a full FastAPI router example see [docs/shared-db-quickstart.md](shared-db-quickstart.md).

---

## §3.1 — Identifiers & Config

### Constants

```python
from shared_db import (
    DATABRICKS_HOST,        # str: full URL, e.g. "https://adb-xxx.azuredatabricks.net"
    WAREHOUSE_HTTP_PATH,    # str: "/sql/1.0/warehouses/<id>"
    TRACE_CATALOG,          # str: Unity Catalog name (env TRACE_CATALOG)
    TRACE_SCHEMA,           # str: schema name (env TRACE_SCHEMA, default "gold")
)
```

All four are read from environment variables at import time. In Databricks Apps they
are injected automatically by the platform.

### `hostname() -> str`

Returns the bare workspace hostname without scheme or trailing slash.

### `tbl(name: str) -> str`

Returns a fully-qualified backtick-quoted table reference:

```python
tbl("gold_material")
# → "`my_catalog`.`gold`.`gold_material`"
```

**Use this for every table reference in SQL strings.** Never hardcode catalog/schema.

### `check_warehouse_config() -> str`

Raises `WarehouseNotConfiguredError` if `DATABRICKS_WAREHOUSE_HTTP_PATH` is unset.
Call from every app factory readiness probe.

### `resolve_token(x_forwarded_access_token, authorization) -> str`

Extracts the Databricks access token from request headers (priority order).
Delegates to `shared_auth.resolve_token`.

---

## §3.2 — Execution

### `run_sql_async` (canonical entry point)

```python
async def run_sql_async(
    token: str,
    statement: str,
    params: list[dict] | None = None,
    *,
    endpoint_hint: str | None = None,
    max_rows: int | None = None,
) -> list[dict]:
```

Executes a SQL statement asynchronously with a single TTL cache. This is the
primary function for FastAPI handler SQL calls.

- **token** — Databricks access token from `resolve_token`.
- **statement** — SQL string. Use `:param_name` placeholders, never f-strings for
  values. Table and column names may use f-strings with `tbl()`.
- **params** — Named parameters built with `sql_param(name, value)`.
- **endpoint_hint** — Optional label for slow-query logs and audit hooks.
- **max_rows** — Appends `LIMIT n` when the statement is a read and has no existing
  LIMIT. Protects against runaway scans.

For more control (tiered cache, audit hooks, concurrency semaphores) use `SqlRuntime`
directly — see §3.3.

### `sql_param(name: str, value) -> dict`

Builds a typed parameter dict for the Databricks SQL Statement API:

```python
sql_param("plant_id", "PL01")   # → {"name": "plant_id", "value": "PL01", "type": "STRING"}
sql_param("count", 42)          # → {"name": "count", "value": "42", "type": "INT"}
sql_param("active", True)       # → {"name": "active", "value": "True", "type": "BOOLEAN"}
```

Types inferred: `bool → BOOLEAN`, `int → INT`, `float → DOUBLE`, everything else → `STRING`.

### `run_sql_in(values, *, prefix="p") -> tuple[str, list[dict]]`

Builds a parameter list for an SQL `IN` predicate:

```python
placeholders, params = run_sql_in(["PL01", "PL02", "PL03"])
statement = f"SELECT * FROM {tbl('gold_plant')} WHERE plant_id IN ({placeholders})"
rows = await run_sql_async(token, statement, params)
```

Returns `("NULL", [])` for empty input so `IN (NULL)` matches no rows safely.

> **Planned (Slice 1B):** A higher-level `run_sql_async` variant that accepts
> `in_param=` and `values=` directly will be added. The current function is the
> parameter-builder primitive.

### `run_sql(token, statement, params=None, *, endpoint_hint=None) -> list[dict]`

Synchronous variant. Use only in scripts, readiness probes, and tests — not in
FastAPI handlers.

### `run_sql_large_async(token, statement, params=None, *, endpoint_hint=None) -> list[dict]`

Asynchronous execution using `EXTERNAL_LINKS` disposition. Use when result sets may
exceed 25 MB. Results are never cached.

### `run_in_sql_executor(fn: Callable[[], T]) -> Awaitable[T]`

Runs a zero-argument blocking callable on the shared SQL thread pool. Use this instead
of importing the private `_sql_executor`:

```python
# Before (private — forbidden):
from shared_db.executors import _sql_executor
rows = await loop.run_in_executor(_sql_executor, lambda: some_blocking_call())

# After (public):
from shared_db import run_in_sql_executor
rows = await run_in_sql_executor(lambda: some_blocking_call())
```

---

## §3.3 — Advanced Runtime

### `SqlRuntime`

The full-featured runtime with tiered caching, audit hooks, write invalidation, and
slow-query logging. Construct once at module level; share across requests.

```python
from shared_db import SqlRuntime, CachePolicy, run_sql

_runtime = SqlRuntime(
    run_sql=lambda token, stmt, params=None: run_sql(token, stmt, params),
    cache_policy=CachePolicy.manufacturing(),
)

rows = await _runtime.run_sql_async(
    token, statement, params,
    endpoint_hint="my_endpoint",
    audit=True,
    bypass_cache=False,
)
```

`SqlRuntime.clear_cache()` purges all tier caches for the process.

### `SqlRuntimeConfig`

Builder dataclass for `SqlRuntime`. Preferred over direct constructor when you need
to pass config through dependency injection:

```python
from shared_db import SqlRuntimeConfig, CachePolicy

config = SqlRuntimeConfig(
    run_sql=my_run_sql,
    cache_policy=CachePolicy.manufacturing(),
    audit_hook=my_audit_hook,
    audit_in_background=True,
)
runtime = config.build()
```

### `CachePolicy` and `CacheTier`

Named tiered cache policies for read-only SQL results.

| Factory | Description |
|---|---|
| `CachePolicy.manufacturing()` | Three tiers: metadata 15 m, scorecards 5 m, charts 3 m. Use for production dashboards. |
| `CachePolicy.single(*, maxsize, ttl_seconds, row_limit)` | Single tier with explicit settings. |
| `CachePolicy.tiered(*tiers)` | Custom tiers from `CacheTier` instances. |

All caches are **in-process only** (no Redis). Entries are bounded by LRU eviction,
explicit `clear_cache()`, and Databricks App restarts. Short TTLs are intentional:
cached rows may contain confidential manufacturing data.

> **Planned (Slice 1B):** `cache_tier=` keyword argument on `run_sql_async` will let
> callers opt into tiered caching without constructing a `SqlRuntime` directly.

### `DataFreshnessRuntime`

Attaches data-staleness metadata to API responses. Queries
`system.information_schema.tables` for `last_altered` timestamps, cached for up to
5 minutes per catalog/schema/view combination.

```python
from shared_db import DataFreshnessRuntime, run_sql, TRACE_CATALOG, TRACE_SCHEMA

_freshness = DataFreshnessRuntime(
    run_sql=lambda token, stmt, params=None: run_sql(token, stmt, params),
    catalog=lambda: TRACE_CATALOG,
    schema=lambda: TRACE_SCHEMA,
)

payload["data_freshness"] = _freshness.get_data_freshness(token, ["gold_batch", "gold_material"])
```

For async attachments with graceful downgrade see `shared_db.utils.attach_payload_freshness`.

### `QueryBuilder`

Builds safe `SELECT` statements for gold-layer views. Validates all identifier inputs.

```python
from shared_db import QueryBuilder, tbl

sql, params = (
    QueryBuilder(base_table=tbl("gold_plant"))
    .with_plant_filter(plant_id)
    .with_order_by("PLANT_ID")
    .with_pagination(limit=100, offset=0)
    .build()
)
```

> **Warning:** `QueryBuilder` is for **read-only SELECT** statements. Never concatenate
> its output into write statements (INSERT/UPDATE/DELETE).

### `fetch_authorized_plants(token, *, catalog=None, schema=None) -> list[str]`

Returns plant IDs the caller is authorized to see (via Unity Catalog row-level security
on `gold_plant`). An empty list means no authorized plants — surface as an empty
plant picker, not an error.

### `assert_plant_authorized(token, plant_id) -> None`

Raises HTTP 403 if `plant_id` is not in the caller's authorized scope. No-op when
`plant_id` is `None`.

---

## §3.4 — Errors & Observability

### `WarehouseNotConfiguredError`

Raised by `check_warehouse_config()` when `DATABRICKS_WAREHOUSE_HTTP_PATH` is unset.

### `classify_sql_runtime_error(exc, *, missing_table_detail=None) -> HTTPException | None`

Maps Databricks SQL connector/REST errors to FastAPI `HTTPException`. Returns `None`
for errors that don't have a clear client-facing mapping (let them become 500s).

```python
from shared_db import classify_sql_runtime_error

try:
    rows = await run_sql_async(...)
except Exception as exc:
    mapped = classify_sql_runtime_error(exc)
    if mapped:
        raise mapped from exc
    raise
```

### `increment_observability_counter(name, *, tags=None)`

Emits a structured JSON counter event to the logger. Wire a metrics sink here.

### `send_operational_alert(*, subject, body, error_id=None, request_path=None)`

Emits a structured JSON critical-severity alert. Wire PagerDuty or equivalent.

---

## `shared_db.utils` — Error Handling & Freshness Helpers

These are available as `from shared_db.utils import ...`:

| Function | Purpose |
|---|---|
| `handle_sql_error(exc)` | Converts SQL exceptions to HTTP 500 with a correlation `error_id` |
| `handle_analysis_error(exc)` | Maps `LinAlgError` → 422, `ValueError` → 422, else delegates to `handle_sql_error` |
| `handle_locked_limits_error(exc)` | Maps missing locked-limits table → 503 with setup instructions |
| `attach_payload_freshness(payload, token, request_path, source_views, fn)` | Attaches freshness metadata; downgrades gracefully to `data_freshness: null` on 503 |
| `attach_validation_freshness(payload, token, request_path, fn)` | Like above, pre-set to `gold_batch_quality_result_v` + `gold_material` views |
| `FreshnessAttacher` | Protocol type for `attach_data_freshness` implementations |

---

## Anti-Patterns

**1. Direct `databricks` imports**

```python
# FORBIDDEN — fails importlinter contract `databricks-sql-only-via-shared-db`
# and AST guard `scripts/tests/test_no_direct_databricks_import.py`
from databricks import sql as databricks_sql
```

All Databricks SQL access goes through `shared_db`.  The importlinter contract
`databricks-sql-only-via-shared-db` (`.importlinter`) enforces this at CI time
across every app backend and shared library.  A complementary AST scan in
`scripts/tests/test_no_direct_databricks_import.py` catches violations without
needing a full environment install.

**2. Importing private executor symbols**

```python
# FORBIDDEN
from shared_db.executors import _sql_executor, _REST_EXECUTOR, _CONNECTOR_EXECUTOR

# CORRECT
from shared_db import run_in_sql_executor
rows = await run_in_sql_executor(lambda: blocking_func())
```

**3. Importing `TTLCache` from `shared_db.core`**

```python
# FORBIDDEN — TTLCache is an implementation detail
from shared_db.core import TTLCache

# If you need a cache, use shared_db.CachePolicy / SqlRuntime
```

**4. SQL string injection**

```python
# FORBIDDEN — SQL injection vector
sql = f"SELECT * FROM {tbl('gold_plant')} WHERE plant_id = '{plant_id}'"

# CORRECT — use :params
sql = f"SELECT * FROM {tbl('gold_plant')} WHERE plant_id = :plant_id"
params = [sql_param("plant_id", plant_id)]
```

**5. Hardcoded catalog/schema**

```python
# FORBIDDEN — won't work across environments
sql = "SELECT * FROM `prod_catalog`.`gold`.`gold_material`"

# CORRECT
sql = f"SELECT * FROM {tbl('gold_material')}"
```

**6. Accessing `SqlRuntime` private attributes**

```python
# FORBIDDEN — internal structure may change
_cache = _runtime._tier_caches["metadata"]

# CORRECT — use the public method
_runtime.clear_cache()
```

---

## Migration Guide

Apps currently using per-app `utils/db.py` wrappers should migrate slice by slice
following [docs/shared-db-migration-matrix.md](shared-db-migration-matrix.md).

**Short path for a new DAL module:**

```python
# apps/myapp/backend/myapp_backend/my_context/dal/widgets.py

from shared_db import tbl, sql_param, run_sql_async, SqlRuntime, CachePolicy, DataFreshnessRuntime, run_sql

_runtime = SqlRuntime(
    run_sql=lambda token, stmt, params=None: run_sql(token, stmt, params),
    cache_policy=CachePolicy.manufacturing(),
)

async def get_widgets(token: str, plant_id: str) -> list[dict]:
    """Return widgets for the given plant."""
    return await _runtime.run_sql_async(
        token,
        f"SELECT * FROM {tbl('gold_widgets')} WHERE plant_id = :plant_id",
        [sql_param("plant_id", plant_id)],
        endpoint_hint="widgets.list",
    )
```

---

## Related documents

- [shared-db-quickstart.md](shared-db-quickstart.md) — one-page tutorial
- [shared-db-migration-matrix.md](shared-db-migration-matrix.md) — per-app migration audit
- [SHARED_DB_PROMOTION_PLAN.md](SHARED_DB_PROMOTION_PLAN.md) — six-slice migration plan
- [libs/shared-db/CHANGELOG.md](../libs/shared-db/CHANGELOG.md) — version history
- [docs/adr/005-shared-db-as-canonical-data-access.md](adr/005-shared-db-as-canonical-data-access.md) — decision record (Slice 1F)
