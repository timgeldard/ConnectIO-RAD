"""
trace2 database utilities.

Core SQL functions are provided by shared_db. This module adds trace2-specific
async execution (single TTL cache), data freshness, and audit helpers.
"""

import asyncio
import json
import logging
import uuid
from typing import Optional

from fastapi import HTTPException

from shared_db.core import (  # noqa: F401  re-exported for existing imports
    DATABRICKS_HOST,
    WAREHOUSE_HTTP_PATH,
    TRACE_CATALOG,
    TRACE_SCHEMA,
    hostname,
    tbl,
    check_warehouse_config,
    resolve_token,
    sql_param,
    run_sql,
    TTLCache,
)
from shared_db.errors import (  # noqa: F401
    classify_sql_runtime_error,
    increment_observability_counter,
    send_operational_alert,
)
from shared_db.executors import _sql_executor
from shared_db.freshness import DataFreshnessRuntime
from shared_db.runtime import SqlRuntime, is_read_only_statement, is_write_statement, sql_cache_key  # noqa: F401

logger = logging.getLogger(__name__)

_sql_runtime = SqlRuntime(run_sql=lambda token, statement, params=None: run_sql(token, statement, params))
_sql_cache = _sql_runtime.cache
_sql_cache_lock = _sql_runtime.cache_lock
_SQL_CACHE_ROW_LIMIT = _sql_runtime.cache_row_limit
_freshness_runtime = DataFreshnessRuntime(
    run_sql=lambda token, statement, params=None: run_sql(token, statement, params),
    catalog=lambda: TRACE_CATALOG,
    schema=lambda: TRACE_SCHEMA,
)


def _clear_sql_cache() -> None:
    _sql_runtime.clear_cache()


async def run_sql_async(
    token: str,
    statement: str,
    params: Optional[list[dict]] = None,
    *,
    endpoint_hint: str = "unknown",
) -> list[dict]:
    """Non-blocking SQL execution with a single TTL read-result cache."""
    return await _sql_runtime.run_sql_async(token, statement, params, endpoint_hint=endpoint_hint)


def get_data_freshness(token: str, source_views: list[str]) -> dict:
    return _freshness_runtime.get_data_freshness(token, source_views)


async def insert_query_audit_event(
    token: str,
    *,
    event_type: str,
    detail: dict,
    sql_hash: Optional[str] = None,
    error_id: Optional[str] = None,
    request_path: Optional[str] = None,
) -> None:
    params = [
        sql_param("audit_id", str(uuid.uuid4())),
        sql_param("event_type", event_type),
        sql_param("sql_hash", sql_hash),
        sql_param("error_id", error_id),
        sql_param("request_path", request_path),
        sql_param("detail_json", json.dumps(detail, separators=(",", ":"))),
    ]
    statement = f"""
        INSERT INTO {tbl('spc_query_audit')} (
            audit_id, event_type, sql_hash, error_id,
            request_path, detail_json, user_id, created_at
        )
        SELECT
            :audit_id, :event_type, :sql_hash, :error_id,
            :request_path, :detail_json, CURRENT_USER(), CURRENT_TIMESTAMP()
    """
    await run_sql_async(token, statement, params)


async def attach_data_freshness(
    payload: dict,
    token: str,
    source_views: list[str],
    *,
    request_path: Optional[str] = None,
) -> dict:
    try:
        loop = asyncio.get_running_loop()
        payload["data_freshness"] = await loop.run_in_executor(
            _sql_executor, lambda: get_data_freshness(token, source_views)
        )
        return payload
    except Exception as exc:
        if isinstance(exc, HTTPException):
            raise
        mapped_error = classify_sql_runtime_error(exc)
        if mapped_error is not None:
            raise mapped_error from exc

        error_id = str(uuid.uuid4())
        logger.exception(
            "data_freshness.failed error_id=%s request_path=%s source_views=%s",
            error_id, request_path or "unknown", ",".join(sorted(set(source_views))),
        )
        try:
            await insert_query_audit_event(
                token,
                event_type="freshness_error",
                error_id=error_id,
                request_path=request_path or "unknown",
                detail={"message": str(exc)[:500], "source_views": sorted(set(source_views))},
            )
        except Exception:
            increment_observability_counter(
                "data_freshness.audit_insert_failed_total",
                tags={"error_id": error_id, "request_path": request_path or "unknown"},
            )
        send_operational_alert(
            subject="trace2 data freshness lookup failed",
            body="Freshness metadata could not be attached. Check spc_query_audit and Databricks SQL.",
            error_id=error_id,
            request_path=request_path or "unknown",
        )
        raise HTTPException(
            status_code=503,
            detail={"message": "Data freshness lookup failed", "error_id": error_id},
        ) from exc
