# shared-db Migration Matrix

Audit of every symbol currently imported by per-app `utils/db.py` wrappers.
Used to plan Slices 1B–1E of the [shared-db promotion plan](SHARED_DB_PROMOTION_PLAN.md).

**Legend**

| Column | Meaning |
|---|---|
| Source | Module the symbol is currently imported from |
| Private? | `yes` = underscore-prefixed; `no` = in public `__all__` |
| Migration target | Where the symbol should come from after the promotion |
| Slice | The slice that migrates this symbol |

---

## SPC — `apps/spc/backend/spc_backend/utils/db.py` (372 LOC)

| Symbol | Source | Private? | Migration target | Slice |
|---|---|---|---|---|
| `DATABRICKS_HOST` | `shared_db.core` | no | `from shared_db import DATABRICKS_HOST` | already OK |
| `WAREHOUSE_HTTP_PATH` | `shared_db.core` | no | `from shared_db import WAREHOUSE_HTTP_PATH` | already OK |
| `TRACE_CATALOG` | `shared_db.core` | no | `from shared_db import TRACE_CATALOG` | already OK |
| `TRACE_SCHEMA` | `shared_db.core` | no | `from shared_db import TRACE_SCHEMA` | already OK |
| `resolve_token` | `shared_db.core` | no | `from shared_db import resolve_token` | already OK |
| `sql_param` | `shared_db.core` | no | `from shared_db import sql_param` | already OK |
| `TTLCache` | `shared_db.core` | **yes** | Remove — SPC no longer needs direct cache access after 1B | 1B |
| `classify_sql_runtime_error` | `shared_db.errors` | no | `from shared_db import classify_sql_runtime_error` | already OK |
| `increment_observability_counter` | `shared_db.errors` | no | `from shared_db import increment_observability_counter` | already OK |
| `send_operational_alert` | `shared_db.errors` | no | `from shared_db import send_operational_alert` | already OK |
| `_CONNECTOR_EXECUTOR` | `shared_db.executors` | **yes** | Remove — executor selection moves into `run_sql_async(concurrency_key=)` | 1D |
| `_REST_EXECUTOR` | `shared_db.executors` | **yes** | Remove — executor selection moves into `run_sql_async(concurrency_key=)` | 1D |
| `_sql_executor` | `shared_db.executors` | **yes** | `from shared_db import run_in_sql_executor` | 1D |
| `DataFreshnessRuntime` | `shared_db.freshness` | no | `from shared_db import DataFreshnessRuntime` | already OK |
| `CachePolicy` | `shared_db.runtime` | no | `from shared_db import CachePolicy` | already OK |
| `SqlRuntimeConfig` | `shared_db.runtime` | no | `from shared_db import SqlRuntimeConfig` (or use `run_sql_async(cache_tier=)`) | 1B/1D |
| `attach_payload_freshness` | `shared_db.utils` | no | `from shared_db.utils import attach_payload_freshness` | already OK |
| `attach_validation_freshness` | `shared_db.utils` | no | `from shared_db.utils import attach_validation_freshness` | already OK |
| `handle_analysis_error` | `shared_db.utils` | no | `from shared_db.utils import handle_analysis_error` | already OK |
| `handle_locked_limits_error` | `shared_db.utils` | no | `from shared_db.utils import handle_locked_limits_error` | already OK |
| `handle_sql_error` | `shared_db.utils` | no | `from shared_db.utils import handle_sql_error` | already OK |
| `from databricks import sql` | (direct) | — | **Delete** — replace with shared_db executor | 1D |

**SPC-specific extras that live in `utils/db.py` and must stay app-owned:**

| Symbol | Nature | Migration target | Slice |
|---|---|---|---|
| `_spc_query_audit_hook` | Domain write — inserts to `spc_query_audit` | New file: `spc_backend/process_control/dal/query_audit.py` | 1D |
| `insert_spc_audit_event` | Domain write | Same DAL file | 1D |
| `insert_spc_query_audit` | Domain write | Same DAL file | 1D |
| `insert_spc_exclusion_snapshot` | Domain write | New file: `spc_backend/process_control/dal/exclusions.py` | 1D |
| `attach_data_freshness` | App-specific freshness attachment | Keep in utils/db.py as a thin wrapper over `shared_db.utils` helper | 1D |

---

## envmon — `apps/envmon/backend/envmon_backend/utils/db.py` (136 LOC)

| Symbol | Source | Private? | Migration target | Slice |
|---|---|---|---|---|
| `DATABRICKS_HOST` | `shared_db.core` | no | `from shared_db import DATABRICKS_HOST` | already OK |
| `WAREHOUSE_HTTP_PATH` | `shared_db.core` | no | `from shared_db import WAREHOUSE_HTTP_PATH` | already OK |
| `TRACE_CATALOG` | `shared_db.core` | no | `from shared_db import TRACE_CATALOG` | already OK |
| `TRACE_SCHEMA` | `shared_db.core` | no | `from shared_db import TRACE_SCHEMA` | already OK |
| `hostname` | `shared_db.core` | no | `from shared_db import hostname` | already OK |
| `tbl` | `shared_db.core` | no | `from shared_db import tbl` | already OK |
| `check_warehouse_config` | `shared_db.core` | no | `from shared_db import check_warehouse_config` | already OK |
| `resolve_token` | `shared_db.core` | no | `from shared_db import resolve_token` | already OK |
| `sql_param` | `shared_db.core` | no | `from shared_db import sql_param` | already OK |
| `TTLCache` | `shared_db.core` | **yes** | Remove — envmon no longer needs direct cache access after 1D | 1D |
| `classify_sql_runtime_error` | `shared_db.errors` | no | `from shared_db import classify_sql_runtime_error` | already OK |
| `increment_observability_counter` | `shared_db.errors` | no | `from shared_db import increment_observability_counter` | already OK |
| `send_operational_alert` | `shared_db.errors` | no | `from shared_db import send_operational_alert` | already OK |
| `_sql_executor` | `shared_db.executors` | **yes** | `from shared_db import run_in_sql_executor` | 1D |
| `_REST_EXECUTOR` | `shared_db.executors` | **yes** | Remove — executor selection removed | 1D |
| `_CONNECTOR_EXECUTOR` | `shared_db.executors` | **yes** | Remove — executor selection removed | 1D |
| `SqlRuntime` | `shared_db.runtime` | no | `from shared_db import SqlRuntime` | already OK |
| `CachePolicy` | `shared_db.runtime` | no | `from shared_db import CachePolicy` | already OK |
| `is_read_only_statement` | `shared_db.runtime` | no | `from shared_db import is_read_only_statement` (if kept public) | already OK |
| `is_write_statement` | `shared_db.runtime` | no | `from shared_db import is_write_statement` (if kept public) | already OK |
| `sql_cache_key` | `shared_db.runtime` | no | `from shared_db import sql_cache_key` (if kept public) | already OK |
| `from databricks import sql` | (direct) | — | **Delete** — replace with shared_db executor | 1D |

---

## trace2 — `apps/trace2/backend/trace2_backend/utils/db.py` (159 LOC)

| Symbol | Source | Private? | Migration target | Slice |
|---|---|---|---|---|
| `_sql_executor` | `shared_db.executors` | **yes** | `from shared_db import run_in_sql_executor` | 1E |
| `attach_payload_freshness` | `shared_db.utils` | no | `from shared_db.utils import attach_payload_freshness` | already OK |
| `attach_validation_freshness` | `shared_db.utils` | no | `from shared_db.utils import attach_validation_freshness` | already OK |
| `handle_sql_error` | `shared_db.utils` | no | `from shared_db.utils import handle_sql_error` | already OK |
| `handle_analysis_error` | `shared_db.utils` | no | `from shared_db.utils import handle_analysis_error` | already OK |
| `DataFreshnessRuntime` | `shared_db` (via `shared_db.freshness`) | no | `from shared_db import DataFreshnessRuntime` | already OK |
| `CachePolicy` | `shared_db.runtime` | no | `from shared_db import CachePolicy` | already OK |
| `SqlRuntime` | `shared_db.runtime` | no | `from shared_db import SqlRuntime` | already OK |

---

## warehouse360 — `apps/warehouse360/backend/warehouse360_backend/utils/db.py` (116 LOC)

| Symbol | Source | Private? | Migration target | Slice |
|---|---|---|---|---|
| Standard shared_db symbols | `shared_db` | no | Already correct | already OK |
| `tbl()` override | local — routes to `WH360_SCHEMA` | — | Consider `tbl(name, schema_override=WH360_SCHEMA)` in shared_db | 1E |

**Note:** warehouse360 shadows `shared_db.tbl()` with its own version that respects `WH360_SCHEMA` env var. The migration needs a schema-override parameter or a named `tbl` factory. Target: collapse to `tbl(name, schema=...)` with env-var-driven default.

---

## connectedquality — `apps/connectedquality/backend/connectedquality_backend/db.py` (58 LOC)

| Symbol | Source | Private? | Migration target | Slice |
|---|---|---|---|---|
| Standard shared_db symbols | `shared_db` | no | Already correct | already OK |
| `tbl()` override | local — routes to `CQ_CATALOG`/`CQ_SCHEMA` | — | Same as W360: schema-override parameter | 1E |

---

## processorderhistory — `apps/processorderhistory/backend/processorderhistory_backend/db.py` (149 LOC)

| Symbol | Source | Private? | Migration target | Slice |
|---|---|---|---|---|
| Standard shared_db symbols | `shared_db` | no | Already correct | already OK |
| `tbl(name)` → POH_SCHEMA | local | — | `tbl(name, schema=POH_SCHEMA)` | 1E |
| `silver_tbl(name)` → silver schema | local | — | `shared_db.silver_tbl(name, catalog=POH_CATALOG)` | 1B |
| `gold_tbl(name)` → gold schema | local | — | `tbl(name, schema="gold")` or named shortcut | 1E |
| `instrument_tbl(name)` → csm_equipment_history | local | — | `tbl(name, schema="csm_equipment_history")` | 1E |
| `validate_timezone` | local | — | Keep in POH — domain-specific | 1E |
| `tz_day_ms` / `tz_hour_ms` / `tz_date` | local | — | Keep in POH — domain-specific SQL helpers | 1E |
| `ORDER_STATUS_EXPR` | local | — | Keep in POH DAL — domain-specific | 1E |

---

## Summary: Private API violations to fix

| Violation | Where | Slice |
|---|---|---|
| `from databricks import sql` | SPC `utils/db.py:50` | 1D |
| `from databricks import sql` | envmon `utils/db.py:42` | 1D |
| `from shared_db.executors import _sql_executor` | SPC `utils/db.py:36`, envmon `utils/db.py:34`, trace2 `utils/db.py:35` | 1D/1E |
| `from shared_db.executors import _REST_EXECUTOR, _CONNECTOR_EXECUTOR` | SPC `utils/db.py:34`, envmon `utils/db.py:35` | 1D |
| `from shared_db.core import TTLCache` | SPC `utils/db.py:26`, envmon `utils/db.py:26` | 1D |
| `_sql_runtime._tier_caches` (reaches into private attribute) | SPC `utils/db.py:173` | 1D |

---

## Symbols currently in `shared_db.__all__` but NOT in plan §3 target API

These are exported today and used by envmon's wrapper. Decision deferred to Slice 1B.

| Symbol | Used by | Recommendation |
|---|---|---|
| `apply_max_rows_guard` | `SqlRuntime` internals (not app code) | Make submodule-private; remove from `__init__.__all__` in 1B |
| `is_read_only_statement` | envmon `utils/db.py` (re-export) | Keep public — genuinely useful to DAL authors |
| `is_write_statement` | envmon `utils/db.py` (re-export) | Keep public — used for cache invalidation decisions |
| `sql_cache_key` | envmon `utils/db.py` (re-export) | Keep public — useful for custom cache key construction |

---

*Generated as part of Slice 1A. Updated by each migration slice.*
