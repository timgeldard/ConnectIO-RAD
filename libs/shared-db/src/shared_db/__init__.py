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
    silver_tbl,
    check_warehouse_config,
    resolve_token,
    sql_param,
    build_in_params,
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
from .audit import QueryAuditHook, register_audit_hook
from .executors import run_in_sql_executor, is_connector_available
from .runtime import (
    CachePolicy,
    CacheTier,
    SqlRuntime,
    SqlRuntimeConfig,
    get_semaphore,
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
    "silver_tbl",
    "check_warehouse_config",
    "resolve_token",
    # §3.2 Execution
    "sql_param",
    "build_in_params",
    "run_sql_in",
    "run_sql",
    "run_sql_async",
    "run_sql_large",
    "run_sql_large_async",
    "run_in_sql_executor",
    "is_connector_available",
    # §3.3 Advanced runtime
    "CachePolicy",
    "CacheTier",
    "SqlRuntime",
    "SqlRuntimeConfig",
    "DataFreshnessRuntime",
    "QueryBuilder",
    "get_semaphore",
    "fetch_authorized_plants",
    "assert_plant_authorized",
    # §3.4 Errors & observability
    "WarehouseNotConfiguredError",
    "classify_sql_runtime_error",
    "increment_observability_counter",
    "send_operational_alert",
    # §3.4 Audit hooks
    "QueryAuditHook",
    "register_audit_hook",
    # Kept public (used by envmon wrapper; review in next major version)
    "is_read_only_statement",
    "is_write_statement",
    "sql_cache_key",
    "apply_max_rows_guard",
]
