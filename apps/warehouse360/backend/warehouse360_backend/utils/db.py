"""
warehouse360 database utilities.

Core SQL functions are provided by shared_db. This module adds wh360-specific
async execution (single TTL cache), data freshness attachment, and concurrency
limiting.
"""

import asyncio
import logging
import os
from typing import Optional

from fastapi import HTTPException

from shared_db.core import (  # noqa: F401  re-exported for router/dal imports
    DATABRICKS_HOST,
    WAREHOUSE_HTTP_PATH,
    TRACE_CATALOG,
    TRACE_SCHEMA,
    hostname,
    check_warehouse_config,
    resolve_token,
    sql_param,
    run_sql,
    TTLCache,
)
from shared_db.executors import _sql_executor
from shared_db.freshness import DataFreshnessRuntime
from shared_db.runtime import SqlRuntime, is_read_only_statement, is_write_statement, sql_cache_key  # noqa: F401

logger = logging.getLogger(__name__)

# Warehouse360 views live in their own schema, separate from the cross-app
# `gold` schema used by CQ/POH. Standalone deploys set TRACE_SCHEMA=wh360 so
# the shared default works; in the platform shell, TRACE_SCHEMA is "gold" for
# the other apps and WH360_SCHEMA is set explicitly.
WH360_SCHEMA: str = os.environ.get("WH360_SCHEMA") or TRACE_SCHEMA


def tbl(name: str) -> str:
    """Resolve a Warehouse360 view to ``<catalog>.<wh360_schema>.<name>``.

    Shadows the shared ``shared_db.core.tbl`` so all W360 DAL code routes to
    the W360-specific schema regardless of the shared `TRACE_SCHEMA` setting.

    Args:
        name: View or table name within the W360 schema.

    Returns:
        Backtick-quoted three-part name suitable for inlining into SQL.
    """
    return f"`{TRACE_CATALOG}`.`{WH360_SCHEMA}`.`{name}`"


_sql_runtime = SqlRuntime(run_sql=lambda token, statement, params=None: run_sql(token, statement, params))
_SQL_SEMAPHORE = asyncio.Semaphore(int(os.environ.get("SQL_CONCURRENCY_LIMIT", "4")))
_sql_cache = _sql_runtime.cache
_sql_cache_lock = _sql_runtime.cache_lock
_SQL_CACHE_ROW_LIMIT = _sql_runtime.cache_row_limit
_freshness_runtime = DataFreshnessRuntime(
    run_sql=lambda token, statement, params=None: run_sql(token, statement, params),
    catalog=lambda: TRACE_CATALOG,
    schema=lambda: WH360_SCHEMA,
)


async def run_sql_async(
    token: str,
    statement: str,
    params: Optional[list[dict]] = None,
    *,
    endpoint_hint: str = "unknown",
) -> list[dict]:
    """Non-blocking SQL execution with TTL cache and per-app concurrency limit."""
    async with _SQL_SEMAPHORE:
        return await _sql_runtime.run_sql_async(token, statement, params, endpoint_hint=endpoint_hint)


def get_data_freshness(token: str, source_views: list[str]) -> dict:
    return _freshness_runtime.get_data_freshness(token, source_views)


async def attach_data_freshness(
    payload: dict,
    token: str,
    source_views: list[str],
    *,
    request_path: Optional[str] = None,
) -> dict:
    """Attach data_freshness metadata to a response payload.

    Runs the freshness lookup in a thread-pool executor so it does not block
    the event loop.  On failure, raises HTTPException(503).
    """
    try:
        loop = asyncio.get_running_loop()
        payload["data_freshness"] = await loop.run_in_executor(
            _sql_executor, lambda: get_data_freshness(token, source_views)
        )
        return payload
    except Exception as exc:
        if isinstance(exc, HTTPException):
            raise
        logger.exception(
            "data_freshness.failed request_path=%s source_views=%s",
            request_path or "unknown",
            ",".join(sorted(set(source_views))),
        )
        raise HTTPException(
            status_code=503,
            detail={"message": "Data freshness lookup failed"},
        ) from exc
