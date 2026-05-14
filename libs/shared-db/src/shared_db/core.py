"""
Core Databricks SQL utilities shared across all ConnectIO-RAD backends.

Exports: run_sql, resolve_token, check_warehouse_config, tbl, sql_param,
         hostname, DATABRICKS_HOST, WAREHOUSE_HTTP_PATH, TRACE_CATALOG,
         TRACE_SCHEMA
"""

__all__ = [
    "DATABRICKS_HOST",
    "WAREHOUSE_HTTP_PATH",
    "TRACE_CATALOG",
    "TRACE_SCHEMA",
    "hostname",
    "tbl",
    "check_warehouse_config",
    "resolve_token",
    "sql_param",
    "run_sql_in",
    "run_sql",
    "run_sql_async",
    "run_sql_large",
    "run_sql_large_async",
]

import asyncio
import logging
import os
import json
import hashlib
import time
import threading
from typing import Any, Optional

from shared_auth import resolve_token as auth_resolve_token
from shared_db.errors import WarehouseNotConfiguredError

try:
    from cachetools import TTLCache as _CachetoolsTTLCache  # type: ignore[import-untyped]
except ImportError:  # pragma: no cover
    class _FallbackTTLCache(dict):
        def __init__(self, maxsize: int, ttl: int):
            super().__init__()
            self.maxsize = maxsize
            self.ttl = ttl
            self._expires: dict[str, float] = {}

        def get(self, key, default=None):
            expires_at = self._expires.get(key)
            if expires_at is not None and expires_at <= time.monotonic():
                self.pop(key, None)
                self._expires.pop(key, None)
                return default
            return super().get(key, default)

        def __setitem__(self, key, value):
            if key not in self and len(self) >= self.maxsize:
                oldest_key = min(self._expires, key=self._expires.get, default=None)
                if oldest_key is not None:
                    self.pop(oldest_key, None)
                    self._expires.pop(oldest_key, None)
            super().__setitem__(key, value)
            self._expires[key] = time.monotonic() + self.ttl
    TTLCache: Any = _FallbackTTLCache
else:
    TTLCache = _CachetoolsTTLCache

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration — read once at import from environment
# ---------------------------------------------------------------------------
DATABRICKS_HOST:    str = os.environ.get("DATABRICKS_HOST", "")
WAREHOUSE_HTTP_PATH: str = os.environ.get("DATABRICKS_WAREHOUSE_HTTP_PATH", "")
TRACE_CATALOG:      str = os.environ.get("TRACE_CATALOG", "")
TRACE_SCHEMA:       str = os.environ.get("TRACE_SCHEMA", "gold")


def hostname() -> str:
    """Return the bare Databricks workspace hostname (no scheme, no trailing slash)."""
    return DATABRICKS_HOST.removeprefix("https://").removeprefix("http://").rstrip("/")


def tbl(name: str) -> str:
    """Return a fully-qualified backtick-quoted table reference."""
    return f"`{TRACE_CATALOG}`.`{TRACE_SCHEMA}`.`{name}`"


def check_warehouse_config() -> str:
    """Raise WarehouseNotConfiguredError if DATABRICKS_WAREHOUSE_HTTP_PATH is not set."""
    if not WAREHOUSE_HTTP_PATH:
        raise WarehouseNotConfiguredError(
            "DATABRICKS_WAREHOUSE_HTTP_PATH environment variable is not set."
        )
    return WAREHOUSE_HTTP_PATH


def resolve_token(
    x_forwarded_access_token: Optional[str],
    authorization: Optional[str],
) -> str:
    """
    Resolve the access token from request headers (priority order).
    
    Delegates to shared_auth.resolve_token.
    """
    return auth_resolve_token(x_forwarded_access_token, authorization)


def sql_param(name: str, value: Optional[object]) -> dict:
    """Build a typed named parameter dict for the Databricks SQL Statement API.

    Type is inferred from the Python type: bool→BOOLEAN, int→INT, float→DOUBLE,
    everything else→STRING. The API always expects ``value`` as a string.
    """
    if value is None:
        return {"name": name, "value": None, "type": "STRING"}
    if isinstance(value, bool):
        db_type = "BOOLEAN"
    elif isinstance(value, int):
        db_type = "INT"
    elif isinstance(value, float):
        db_type = "DOUBLE"
    else:
        db_type = "STRING"
    return {"name": name, "value": str(value), "type": db_type}


def run_sql_in(
    values: list[object],
    *,
    prefix: str = "p",
) -> tuple[str, list[dict]]:
    """Build a typed parameter list for a SQL ``IN`` predicate.

    Args:
        values: Typed values to bind into the predicate.
        prefix: Parameter name prefix. Parameters are emitted as
            ``:<prefix>0, :<prefix>1, ...``.

    Returns:
        A tuple of SQL fragment and matching Databricks SQL parameters. Empty
        values return ``("NULL", [])`` so callers can safely write
        ``IN ({fragment})`` and match no rows without producing invalid SQL.
    """
    if not values:
        return "NULL", []
    placeholders = ", ".join(f":{prefix}{idx}" for idx in range(len(values)))
    params = [sql_param(f"{prefix}{idx}", value) for idx, value in enumerate(values)]
    return placeholders, params


# ---------------------------------------------------------------------------
# run_sql — synchronous, used in readiness probes and simple one-off queries
# ---------------------------------------------------------------------------
_sql_cache = TTLCache(maxsize=100, ttl=300)
_sql_cache_lock = threading.Lock()
_SQL_CACHE_ROW_LIMIT = 1000
_SQL_SLOW_QUERY_THRESHOLD_MS = int(os.environ.get("SQL_SLOW_QUERY_THRESHOLD_MS", "3000"))


def _core_sql_cache_key(statement: str, params: Optional[list[dict]] = None) -> str:
    """Build a token-independent data cache key for the base SQL runtime."""
    payload = json.dumps(params or [], sort_keys=True, default=str, separators=(",", ":"))
    return ":".join(
        [
            hashlib.sha256(statement.encode()).hexdigest(),
            hashlib.sha256(payload.encode()).hexdigest(),
        ]
    )


def _log_slow_query(*, duration_ms: int, endpoint_hint: str | None) -> None:
    """Log slow SQL calls for N+1 and warehouse latency detection."""
    if duration_ms > _SQL_SLOW_QUERY_THRESHOLD_MS:
        logger.warning(
            "sql.slow_query duration_ms=%d endpoint=%s",
            duration_ms,
            endpoint_hint or "unknown",
        )


def run_sql(
    token: str,
    statement: str,
    params: Optional[list[dict]] = None,
    *,
    endpoint_hint: Optional[str] = None,
) -> list[dict]:
    """
    Execute a SQL statement synchronously via the REST executor.
    
    Args:
        token: Databricks access token.
        statement: The SQL query to execute.
        params: Optional list of parameter dicts for the query.
        endpoint_hint: Optional logic name of the calling endpoint for logging.
        
    Returns:
        List of dictionaries representing the query result rows.
    """
    from .executors import _REST_EXECUTOR
    if endpoint_hint:
        logger.info("sql.execute hint=%s", endpoint_hint)
    
    app_name = os.environ.get("APP_NAME", "unknown")
    tagged_statement = f"/* App={app_name}, Module={endpoint_hint or 'unknown'} */\n{statement}"
    return _REST_EXECUTOR.execute(token, tagged_statement, params)


async def run_sql_async(
    token: str,
    statement: str,
    params: Optional[list[dict]] = None,
    *,
    endpoint_hint: Optional[str] = None,
    max_rows: int | None = None,
) -> list[dict]:
    """
    Execute a SQL statement asynchronously with a single TTL cache.

    This is the base implementation used by trace2 and envmon. SPC overrides
    this with its own tiered-cache version in apps/spc/backend/utils/db.py.

    Args:
        token: Databricks access token.
        statement: The SQL query to execute.
        params: Optional list of parameter dicts for the query.
        endpoint_hint: Optional logic name of the calling endpoint for logging.
        
    Returns:
        List of dictionaries representing the query result rows.
    """
    from .executors import _sql_executor, _REST_EXECUTOR
    from .runtime import apply_max_rows_guard

    statement_to_execute = apply_max_rows_guard(statement, max_rows)
    cache_key = _core_sql_cache_key(statement_to_execute, params)

    with _sql_cache_lock:
        cached = _sql_cache.get(cache_key)
    if cached is not None:
        return cached

    if endpoint_hint:
        logger.info("sql.execute_async hint=%s", endpoint_hint)

    app_name = os.environ.get("APP_NAME", "unknown")
    tagged_statement = f"/* App={app_name}, Module={endpoint_hint or 'unknown'} */\n{statement_to_execute}"

    started_at = time.monotonic()
    rows = await asyncio.get_running_loop().run_in_executor(
        _sql_executor,
        lambda: _REST_EXECUTOR.execute(token, tagged_statement, params),
    )
    duration_ms = int((time.monotonic() - started_at) * 1000)
    _log_slow_query(duration_ms=duration_ms, endpoint_hint=endpoint_hint)

    if len(rows) <= _SQL_CACHE_ROW_LIMIT:
        with _sql_cache_lock:
            _sql_cache[cache_key] = rows

    return rows


def run_sql_large(
    token: str,
    statement: str,
    params: Optional[list[dict]] = None,
    *,
    endpoint_hint: Optional[str] = None,
) -> list[dict]:
    """
    Execute a SQL statement synchronously using EXTERNAL_LINKS disposition.

    Stores results in cloud storage (pre-signed URLs) rather than inline,
    bypassing the 25 MB inline result cap. Results are never cached.

    Args:
        token: Databricks access token.
        statement: The SQL query to execute.
        params: Optional list of parameter dicts for the query.
        endpoint_hint: Optional logic name of the calling endpoint for logging.

    Returns:
        List of dictionaries representing the query result rows.
    """
    from .executors import _REST_EXECUTOR
    if endpoint_hint:
        logger.info("sql.execute_large hint=%s", endpoint_hint)

    app_name = os.environ.get("APP_NAME", "unknown")
    tagged_statement = f"/* App={app_name}, Module={endpoint_hint or 'unknown'} */\n{statement}"
    return _REST_EXECUTOR.execute(token, tagged_statement, params, large_result=True)


async def run_sql_large_async(
    token: str,
    statement: str,
    params: Optional[list[dict]] = None,
    *,
    endpoint_hint: Optional[str] = None,
) -> list[dict]:
    """
    Execute a SQL statement asynchronously using EXTERNAL_LINKS disposition.

    Stores results in cloud storage (pre-signed URLs) rather than inline,
    bypassing the 25 MB inline result cap. Results are never cached.

    Args:
        token: Databricks access token.
        statement: The SQL query to execute.
        params: Optional list of parameter dicts for the query.
        endpoint_hint: Optional logic name of the calling endpoint for logging.

    Returns:
        List of dictionaries representing the query result rows.
    """
    from .executors import _sql_executor, _REST_EXECUTOR
    if endpoint_hint:
        logger.info("sql.execute_large_async hint=%s", endpoint_hint)

    app_name = os.environ.get("APP_NAME", "unknown")
    tagged_statement = f"/* App={app_name}, Module={endpoint_hint or 'unknown'} */\n{statement}"

    return await asyncio.get_running_loop().run_in_executor(
        _sql_executor,
        lambda: _REST_EXECUTOR.execute(token, tagged_statement, params, large_result=True),
    )
