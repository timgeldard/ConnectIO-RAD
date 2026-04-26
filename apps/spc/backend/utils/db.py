"""
SPC database utilities.

Core SQL functions are provided by shared_db. This module adds SPC-specific
tiered caching, configurable executor selection, query audit integration,
data freshness, and exclusion snapshot helpers.
"""

import asyncio
import hashlib
import json
import logging
import os
import re
import threading
import time
import uuid
import orjson
from typing import Optional

from fastapi import HTTPException

from shared_db.core import (  # noqa: F401  re-exported for existing imports
    DATABRICKS_HOST,
    WAREHOUSE_HTTP_PATH,
    TRACE_CATALOG,
    TRACE_SCHEMA,
    resolve_token,
    sql_param,
    TTLCache,
)
from shared_db.errors import (  # noqa: F401
    classify_sql_runtime_error,
    increment_observability_counter,
    send_operational_alert,
)
from shared_db.executors import (
    _CONNECTOR_EXECUTOR,
    _REST_EXECUTOR,
    _sql_executor,
)
from shared_db.runtime import (
    CachePolicy,
    CacheTier,
    SqlRuntimeConfig,
    is_read_only_statement as _shared_is_read_only_statement,
    is_write_statement as _shared_is_write_statement,
    sql_cache_key as _shared_sql_cache_key,
    statement_prefix as _shared_statement_prefix,
)

try:
    from databricks import sql as databricks_sql
except ImportError:  # pragma: no cover
    databricks_sql = None

logger = logging.getLogger(__name__)
_VIEW_NAME_RE = re.compile(r"^[A-Za-z0-9_]+$")

_freshness_cache     = TTLCache(maxsize=50,  ttl=300)
_freshness_cache_lock = threading.Lock()

_SQL_CACHE_ROW_LIMIT = 1000
_QUERY_AUDIT_TABLE_NAME = "spc_query_audit"

_METADATA_CACHE_PATTERNS = (
    "information_schema.tables", "spc_characteristic_dim_mv",
    "spc_attribute_quality_metrics", "gold_material", "gold_plant",
)
_SCORECARD_CACHE_PATTERNS = ("spc_quality_metrics",)


def hostname() -> str:
    return DATABRICKS_HOST.removeprefix("https://").removeprefix("http://").rstrip("/")


def tbl(name: str) -> str:
    return f"`{TRACE_CATALOG}`.`{TRACE_SCHEMA}`.`{name}`"


def check_warehouse_config() -> str:
    if not WAREHOUSE_HTTP_PATH:
        raise HTTPException(
            status_code=500,
            detail="DATABRICKS_WAREHOUSE_HTTP_PATH environment variable is not set.",
        )
    return WAREHOUSE_HTTP_PATH


def _warehouse_id() -> str:
    return WAREHOUSE_HTTP_PATH.rsplit("/", 1)[-1]


def _params_to_mapping(params: Optional[list[dict]]) -> dict[str, object | None]:
    return {str(p["name"]): p.get("value") for p in (params or [])}


def _first_param_value(params: Optional[list[dict]], *names: str) -> Optional[str]:
    mapping = _params_to_mapping(params)
    for name in names:
        value = mapping.get(name)
        if value is not None and value != "":
            return str(value)
    return None


def _statement_prefix(statement: str) -> str:
    return _shared_statement_prefix(statement)


def _is_read_only_statement(statement: str) -> bool:
    return _shared_is_read_only_statement(statement)


def _is_write_statement(statement: str) -> bool:
    return _shared_is_write_statement(statement)


def _is_query_audit_statement(statement: str) -> bool:
    return _QUERY_AUDIT_TABLE_NAME in statement.lower()


def _sql_cache_tier(statement: str) -> str:
    tier = _sql_runtime._cache_tier_for(statement)
    return tier.name if tier is not None else "chart"


def _sql_cache_bucket(statement: str) -> tuple[TTLCache, threading.Lock]:
    tier = _sql_cache_tier(statement)
    if tier == "metadata":
        return _metadata_cache, _metadata_cache_lock
    if tier == "scorecard":
        return _scorecard_cache, _scorecard_cache_lock
    return _chart_cache, _chart_cache_lock


def _clear_sql_cache() -> None:
    _sql_runtime.clear_cache()


def _sql_cache_key(token: str, statement: str, params: Optional[list[dict]] = None) -> str:
    return _shared_sql_cache_key(token, statement, params)


def _should_cache_rows(rows: list[dict]) -> bool:
    return len(rows) <= _SQL_CACHE_ROW_LIMIT


# ---------------------------------------------------------------------------
# SPC executor selection (REST vs. Databricks SQL Connector)
# ---------------------------------------------------------------------------
def _configured_sql_executor_name() -> str:
    configured = os.environ.get("SPC_SQL_EXECUTOR", "rest").strip().lower()
    return configured if configured in {"rest", "connector"} else "rest"


def _get_sql_executor():
    configured = _configured_sql_executor_name()
    if configured == "connector":
        if databricks_sql is None:
            logger.warning("connector requested but unavailable; falling back to rest")
            return _REST_EXECUTOR
        return _CONNECTOR_EXECUTOR
    return _REST_EXECUTOR


def run_sql(
    token: str,
    statement: str,
    params: Optional[list[dict]] = None,
) -> list[dict]:
    return _get_sql_executor().execute(token, statement, params)


async def _spc_query_audit_hook(
    *,
    token: str,
    statement: str,
    params: Optional[list[dict]],
    endpoint_hint: str,
    rows: list[dict] | None = None,
    error: Exception | None = None,
    duration_ms: int | None = None,
) -> None:
    if error is not None or _is_query_audit_statement(statement):
        return
    try:
        await insert_spc_query_audit(
            token,
            endpoint=endpoint_hint,
            params=params,
            row_count=len(rows or []),
            duration_ms=duration_ms or 0,
        )
    except Exception:
        logger.warning("sql.query_audit_insert_failed endpoint=%s", endpoint_hint, exc_info=True)


_sql_runtime_config = SqlRuntimeConfig(
    run_sql=lambda token, statement, params=None: run_sql(token, statement, params),
    cache_policy=CachePolicy.tiered(
        CacheTier(
            "metadata",
            maxsize=500,
            ttl_seconds=900,
            row_limit=_SQL_CACHE_ROW_LIMIT,
            patterns=_METADATA_CACHE_PATTERNS,
        ),
        CacheTier(
            "scorecard",
            maxsize=200,
            ttl_seconds=300,
            row_limit=_SQL_CACHE_ROW_LIMIT,
            prefixes=("SELECT", "WITH"),
            patterns=_SCORECARD_CACHE_PATTERNS,
        ),
        CacheTier(
            "chart",
            maxsize=300,
            ttl_seconds=180,
            row_limit=_SQL_CACHE_ROW_LIMIT,
            prefixes=("SELECT", "WITH", "SHOW", "DESCRIBE"),
        ),
    ),
    audit_hook=_spc_query_audit_hook,
    audit_in_background=True,
)
_sql_runtime = _sql_runtime_config.build()

_metadata_cache = _sql_runtime._tier_caches["metadata"]
_metadata_cache_lock = _sql_runtime.cache_lock
_scorecard_cache = _sql_runtime._tier_caches["scorecard"]
_scorecard_cache_lock = _sql_runtime.cache_lock
_chart_cache = _sql_runtime._tier_caches["chart"]
_chart_cache_lock = _sql_runtime.cache_lock


# ---------------------------------------------------------------------------
# SPC run_sql_async — shared runtime with tiered cache + query audit
# ---------------------------------------------------------------------------
async def run_sql_async(
    token: str,
    statement: str,
    params: Optional[list[dict]] = None,
    *,
    endpoint_hint: str = "unknown",
    audit: bool = True,
) -> list[dict]:
    is_query_audit_statement = _is_query_audit_statement(statement)
    return await _sql_runtime.run_sql_async(
        token,
        statement,
        params,
        endpoint_hint=endpoint_hint,
        audit=audit and not is_query_audit_statement,
        invalidate_cache=not is_query_audit_statement,
    )


# ---------------------------------------------------------------------------
# Data freshness
# ---------------------------------------------------------------------------
def get_data_freshness(token: str, source_views: list[str]) -> dict:
    safe_views = sorted({v for v in source_views if _VIEW_NAME_RE.match(v)})
    if not safe_views:
        return {"generated_at_utc": int(time.time()), "sources": []}

    token_hash = hashlib.sha256(token.encode()).hexdigest()
    cache_key = (token_hash, tuple(safe_views))
    with _freshness_cache_lock:
        cached = _freshness_cache.get(cache_key)
    if cached is not None:
        return orjson.loads(cached)

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
    result = {
        "generated_at_utc": int(time.time()),
        "catalog": TRACE_CATALOG,
        "schema": TRACE_SCHEMA,
        "sources": rows,
    }
    with _freshness_cache_lock:
        _freshness_cache[cache_key] = orjson.dumps(result)
    return result


# ---------------------------------------------------------------------------
# Audit helpers
# ---------------------------------------------------------------------------
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
        sql_param("query_id", error_id or str(uuid.uuid4())),
        sql_param("endpoint", request_path or f"audit:{event_type}"),
        sql_param("material_id", detail.get("material_id")),
        sql_param("mic_id", detail.get("mic_id")),
        sql_param("plant_id", detail.get("plant_id")),
        sql_param("row_count", 0),
        sql_param("duration_ms", 0),
        sql_param("warehouse_id", _warehouse_id()),
    ]
    statement = f"""
        INSERT INTO {tbl('spc_query_audit')} (
            query_id, endpoint, material_id, mic_id, plant_id,
            row_count, duration_ms, warehouse_id, user_identity, executed_at
        )
        SELECT
            :query_id, :endpoint, :material_id, :mic_id, :plant_id,
            CAST(:row_count AS INT), CAST(:duration_ms AS BIGINT),
            :warehouse_id, CURRENT_USER(), CURRENT_TIMESTAMP()
    """
    await run_sql_async(token, statement, params, endpoint_hint="spc.audit-event", audit=False)


async def insert_spc_query_audit(
    token: str,
    *,
    endpoint: str,
    params: Optional[list[dict]],
    row_count: int,
    duration_ms: int,
) -> None:
    insert_params = [
        sql_param("query_id", str(uuid.uuid4())),
        sql_param("endpoint", endpoint),
        sql_param("material_id", _first_param_value(params, "material_id")),
        sql_param("mic_id", _first_param_value(params, "mic_id", "mic_a_id", "mic_b_id")),
        sql_param("plant_id", _first_param_value(params, "plant_id")),
        sql_param("row_count", row_count),
        sql_param("duration_ms", duration_ms),
        sql_param("warehouse_id", _warehouse_id()),
    ]
    statement = f"""
        INSERT INTO {tbl('spc_query_audit')} (
            query_id, endpoint, material_id, mic_id, plant_id,
            row_count, duration_ms, warehouse_id, user_identity, executed_at
        )
        SELECT
            :query_id, :endpoint, :material_id, :mic_id, :plant_id,
            CAST(:row_count AS INT), CAST(:duration_ms AS BIGINT),
            :warehouse_id, CURRENT_USER(), CURRENT_TIMESTAMP()
    """
    await run_sql_async(token, statement, insert_params, endpoint_hint="spc.query-audit", audit=False)


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
            logger.exception("data_freshness.audit_insert_failed error_id=%s", error_id)
        send_operational_alert(
            subject="SPC data freshness lookup failed",
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
    await run_sql_async(token, insert_sql, params, endpoint_hint="spc.exclusions.insert", audit=False)
