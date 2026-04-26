"""
Core Databricks SQL utilities shared across all ConnectIO-RAD backends.

Exports: run_sql, resolve_token, check_warehouse_config, tbl, sql_param,
         hostname, DATABRICKS_HOST, WAREHOUSE_HTTP_PATH, TRACE_CATALOG,
         TRACE_SCHEMA
"""

import asyncio
import logging
import os
import time
import threading
from typing import Optional

from fastapi import HTTPException

try:
    from cachetools import TTLCache
except ImportError:  # pragma: no cover
    class TTLCache(dict):
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

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration — read once at import from environment
# ---------------------------------------------------------------------------
DATABRICKS_HOST:    str = os.environ.get("DATABRICKS_HOST", "")
WAREHOUSE_HTTP_PATH: str = os.environ.get("DATABRICKS_WAREHOUSE_HTTP_PATH", "")
TRACE_CATALOG:      str = os.environ.get("TRACE_CATALOG", "connected_plant_uat")
TRACE_SCHEMA:       str = os.environ.get("TRACE_SCHEMA", "gold")


def hostname() -> str:
    """Return the bare Databricks workspace hostname (no scheme, no trailing slash)."""
    return DATABRICKS_HOST.removeprefix("https://").removeprefix("http://").rstrip("/")


def tbl(name: str) -> str:
    """Return a fully-qualified backtick-quoted table reference."""
    return f"`{TRACE_CATALOG}`.`{TRACE_SCHEMA}`.`{name}`"


def check_warehouse_config() -> str:
    """Raise HTTP 500 if DATABRICKS_WAREHOUSE_HTTP_PATH is not set."""
    if not WAREHOUSE_HTTP_PATH:
        raise HTTPException(
            status_code=500,
            detail="DATABRICKS_WAREHOUSE_HTTP_PATH environment variable is not set.",
        )
    return WAREHOUSE_HTTP_PATH


def resolve_token(
    x_forwarded_access_token: Optional[str],
    authorization: Optional[str],
) -> str:
    """
    Resolve the access token from request headers (priority order):
      1. x-forwarded-access-token  — injected by the Databricks Apps proxy
      2. Authorization: Bearer     — for local development / direct API calls
    """
    token = x_forwarded_access_token
    if token is None and authorization and authorization.startswith("Bearer "):
        token = authorization[len("Bearer "):]
    if not token:
        raise HTTPException(
            status_code=401,
            detail=(
                "No access token present. Expected x-forwarded-access-token "
                "header (set by Databricks Apps proxy) or Authorization: Bearer."
            ),
        )
    return token


def sql_param(name: str, value: Optional[object]) -> dict:
    """Build a named STRING parameter dict for the Databricks SQL Statement API."""
    return {"name": name, "value": str(value) if value is not None else None, "type": "STRING"}


# ---------------------------------------------------------------------------
# run_sql — synchronous, used in readiness probes and simple one-off queries
# ---------------------------------------------------------------------------
_sql_cache = TTLCache(maxsize=100, ttl=300)
_sql_cache_lock = threading.Lock()
_SQL_CACHE_ROW_LIMIT = 1000


def run_sql(
    token: str,
    statement: str,
    params: Optional[list[dict]] = None,
) -> list[dict]:
    """
    Execute a SQL statement synchronously via the REST executor.
    
    Args:
        token: Databricks access token.
        statement: The SQL query to execute.
        params: Optional list of parameter dicts for the query.
        
    Returns:
        List of dictionaries representing the query result rows.
    """
    from .executors import _REST_EXECUTOR
    return _REST_EXECUTOR.execute(token, statement, params)


async def run_sql_async(
    token: str,
    statement: str,
    params: Optional[list[dict]] = None,
) -> list[dict]:
    """
    Execute a SQL statement asynchronously with a single TTL cache.

    This is the base implementation used by trace2 and envmon. SPC overrides
    this with its own tiered-cache version in apps/spc/backend/utils/db.py.

    Args:
        token: Databricks access token.
        statement: The SQL query to execute.
        params: Optional list of parameter dicts for the query.
        
    Returns:
        List of dictionaries representing the query result rows.
    """
    from .executors import _sql_executor, _REST_EXECUTOR
    import hashlib
    cache_key = hashlib.sha256(
        f"{token}:{statement}:{params!r}".encode()
    ).hexdigest()

    with _sql_cache_lock:
        cached = _sql_cache.get(cache_key)
    if cached is not None:
        return cached

    rows = await asyncio.get_event_loop().run_in_executor(
        _sql_executor,
        lambda: _REST_EXECUTOR.execute(token, statement, params),
    )

    if len(rows) <= _SQL_CACHE_ROW_LIMIT:
        with _sql_cache_lock:
            _sql_cache[cache_key] = rows

    return rows
