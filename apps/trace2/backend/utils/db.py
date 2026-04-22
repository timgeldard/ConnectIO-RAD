"""
trace2 database utilities.

Core SQL functions are provided by shared_db. This module adds trace2-specific
async execution (single TTL cache), data freshness, and audit helpers.
"""

import asyncio
import hashlib
import json
import logging
import re
import threading
import time
import uuid
from copy import deepcopy
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

logger = logging.getLogger(__name__)
_VIEW_NAME_RE = re.compile(r"^[A-Za-z0-9_]+$")

_sql_cache: TTLCache = TTLCache(maxsize=100, ttl=300)
_sql_cache_lock = threading.Lock()
_SQL_CACHE_ROW_LIMIT = 1000


def _sql_cache_key(token: str, statement: str, params: Optional[list[dict]] = None) -> str:
    payload = json.dumps(params or [], sort_keys=True, default=str, separators=(",", ":"))
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    stmt_hash = hashlib.sha256(statement.encode()).hexdigest()
    param_hash = hashlib.sha256(payload.encode()).hexdigest()
    return f"{token_hash}:{stmt_hash}:{param_hash}"


async def run_sql_async(
    token: str,
    statement: str,
    params: Optional[list[dict]] = None,
) -> list[dict]:
    """Non-blocking SQL execution with a single TTL result cache."""
    cache_key = _sql_cache_key(token, statement, params)
    with _sql_cache_lock:
        cached_rows = _sql_cache.get(cache_key)
    if cached_rows is not None:
        return deepcopy(cached_rows)

    loop = asyncio.get_running_loop()
    rows = await loop.run_in_executor(_sql_executor, lambda: run_sql(token, statement, params))
    if len(rows) <= _SQL_CACHE_ROW_LIMIT:
        with _sql_cache_lock:
            _sql_cache[cache_key] = deepcopy(rows)
    return rows


def get_data_freshness(token: str, source_views: list[str]) -> dict:
    safe_views = sorted({v for v in source_views if _VIEW_NAME_RE.match(v)})
    if not safe_views:
        return {"generated_at_utc": int(time.time()), "sources": []}

    params = [
        sql_param("catalog_name", TRACE_CATALOG),
        sql_param("schema_name", TRACE_SCHEMA),
    ]
    view_clauses: list[str] = []
    for idx, view in enumerate(safe_views):
        param_name = f"view_{idx}"
        view_clauses.append(f"table_name = :{param_name}")
        params.append(sql_param(param_name, view))

    query = f"""
        SELECT
            table_name AS source_view,
            CAST(last_altered AS STRING) AS last_altered_utc
        FROM system.information_schema.tables
        WHERE table_catalog = :catalog_name
          AND table_schema = :schema_name
          AND ({' OR '.join(view_clauses)})
        ORDER BY table_name
    """
    rows = run_sql(token, query, params)
    return {
        "generated_at_utc": int(time.time()),
        "catalog": TRACE_CATALOG,
        "schema": TRACE_SCHEMA,
        "sources": rows,
    }


async def insert_spc_audit_event(
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
            await insert_spc_audit_event(
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


async def insert_spc_exclusion_snapshot(token: str, payload: dict) -> None:
    params = [
        sql_param("event_id", payload["event_id"]),
        sql_param("material_id", payload["material_id"]),
        sql_param("mic_id", payload["mic_id"]),
        sql_param("mic_name", payload.get("mic_name")),
        sql_param("plant_id", payload.get("plant_id")),
        sql_param("stratify_all", payload.get("stratify_all", False)),
        sql_param("stratify_by", payload.get("stratify_by")),
        sql_param("chart_type", payload["chart_type"]),
        sql_param("date_from", payload.get("date_from")),
        sql_param("date_to", payload.get("date_to")),
        sql_param("rule_set", payload.get("rule_set")),
        sql_param("justification", payload["justification"]),
        sql_param("action", payload.get("action")),
        sql_param("excluded_count", payload["excluded_count"]),
        sql_param("excluded_points_json", json.dumps(payload["excluded_points"], separators=(",", ":"))),
        sql_param("before_limits_json", json.dumps(payload.get("before_limits"), separators=(",", ":"))),
        sql_param("after_limits_json", json.dumps(payload.get("after_limits"), separators=(",", ":"))),
    ]
    insert_sql = f"""
        INSERT INTO {tbl('spc_exclusions')} (
            event_id, material_id, mic_id, mic_name, plant_id,
            stratify_all, stratify_by, chart_type, date_from, date_to,
            rule_set, justification, action, excluded_count,
            excluded_points_json, before_limits_json, after_limits_json,
            user_id, event_ts
        )
        SELECT
            :event_id, :material_id, :mic_id, :mic_name, :plant_id,
            CAST(:stratify_all AS BOOLEAN), :stratify_by, :chart_type, :date_from, :date_to,
            :rule_set, :justification, :action, CAST(:excluded_count AS INT),
            :excluded_points_json, :before_limits_json, :after_limits_json,
            CURRENT_USER(), CURRENT_TIMESTAMP()
    """
    await run_sql_async(token, insert_sql, params)
