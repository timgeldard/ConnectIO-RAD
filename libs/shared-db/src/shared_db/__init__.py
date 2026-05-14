"""
shared_db — the only sanctioned path from ConnectIO-RAD Python code to Databricks SQL.

All imports in app and library code must come from this package (or ``shared_db.utils``
for error-handling helpers). Direct ``databricks`` imports are forbidden outside this
package; the importlinter contract ``databricks-sql-only-via-shared-db`` enforces this
in CI (added in Slice 1C of the shared-db promotion plan).

See docs/shared-db.md for the full API reference and migration guide.
"""

from .core import (
    DATABRICKS_HOST,
    WAREHOUSE_HTTP_PATH,
    TRACE_CATALOG,
    TRACE_SCHEMA,
    hostname,
    tbl,
    check_warehouse_config,
    resolve_token,
    sql_param,
    run_sql_in,
    run_sql,
    run_sql_async,
    run_sql_large,
    run_sql_large_async,
)
from .errors import (
    WarehouseNotConfiguredError,
    classify_sql_runtime_error,
    increment_observability_counter,
    send_operational_alert,
)
from .executors import run_in_sql_executor
from .runtime import (
    CachePolicy,
    CacheTier,
    SqlRuntime,
    SqlRuntimeConfig,
    apply_max_rows_guard,
    is_read_only_statement,
    is_write_statement,
    sql_cache_key,
)
from .freshness import DataFreshnessRuntime
from .authorized_scope import fetch_authorized_plants, assert_plant_authorized
from .query_builder import QueryBuilder

__all__ = [
    # §3.1 Identifiers & config
    "DATABRICKS_HOST",
    "WAREHOUSE_HTTP_PATH",
    "TRACE_CATALOG",
    "TRACE_SCHEMA",
    "hostname",
    "tbl",
    "check_warehouse_config",
    "resolve_token",
    # §3.2 Execution
    "sql_param",
    "run_sql_in",
    "run_sql",
    "run_sql_async",
    "run_sql_large",
    "run_sql_large_async",
    "run_in_sql_executor",
    # §3.3 Advanced runtime
    "CachePolicy",
    "CacheTier",
    "SqlRuntime",
    "SqlRuntimeConfig",
    "DataFreshnessRuntime",
    "QueryBuilder",
    "fetch_authorized_plants",
    "assert_plant_authorized",
    # §3.4 Errors & observability
    "WarehouseNotConfiguredError",
    "classify_sql_runtime_error",
    "increment_observability_counter",
    "send_operational_alert",
    # Semi-private utilities — kept public pending §3 review in Slice 1B
    "is_read_only_statement",
    "is_write_statement",
    "sql_cache_key",
    "apply_max_rows_guard",
]
