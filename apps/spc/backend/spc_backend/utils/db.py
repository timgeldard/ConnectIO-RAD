"""
SPC database utilities.

Core SQL functions are provided by shared_db. This module adds SPC-specific
tiered caching, configurable executor selection, query audit integration,
data freshness, and exclusion snapshot helpers.
"""

import asyncio
import logging
import os
import re
import uuid
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
from shared_db import is_connector_available
from shared_db.executors import (
    _CONNECTOR_EXECUTOR,
    _REST_EXECUTOR,
    _sql_executor,
)
from shared_db.freshness import DataFreshnessRuntime
from shared_db.runtime import CachePolicy, SqlRuntimeConfig
from shared_db.utils import (  # noqa: F401
    attach_payload_freshness,
    attach_validation_freshness,
    handle_analysis_error,
    handle_locked_limits_error,
    handle_sql_error,
)
from shared_trace import schema

logger = logging.getLogger(__name__)
_VIEW_NAME_RE = re.compile(r"^[A-Za-z0-9_]+$")

_SQL_CACHE_ROW_LIMIT = 1000
_QUERY_AUDIT_TABLE_NAME = schema.SPC_QUERY_AUDIT

_METADATA_CACHE_PATTERNS = (
    "information_schema.tables", schema.SPC_CHARACTERISTIC_DIM_MV,
    "spc_attribute_quality_metrics", schema.GOLD_MATERIAL, schema.GOLD_PLANT,
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


def _is_query_audit_statement(statement: str) -> bool:
    return _QUERY_AUDIT_TABLE_NAME in statement.lower()


def _sql_cache_tier(statement: str) -> str:
    tier = _sql_runtime._cache_tier_for(statement)
    return tier.name if tier is not None else "chart"


def _clear_sql_cache() -> None:
    _sql_runtime.clear_cache()


# ---------------------------------------------------------------------------
# SPC executor selection (REST vs. Databricks SQL Connector)
# ---------------------------------------------------------------------------
def _configured_sql_executor_name() -> str:
    configured = os.environ.get("SPC_SQL_EXECUTOR", "rest").strip().lower()
    return configured if configured in {"rest", "connector"} else "rest"


def _get_sql_executor():
    configured = _configured_sql_executor_name()
    if configured == "connector":
        if not is_connector_available():
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
    cache_policy=CachePolicy.manufacturing(row_limit=_SQL_CACHE_ROW_LIMIT),
    audit_hook=_spc_query_audit_hook,
    audit_in_background=True,
)
_sql_runtime = _sql_runtime_config.build()
_SQL_SEMAPHORE = asyncio.Semaphore(int(os.environ.get("SQL_CONCURRENCY_LIMIT", "4")))

_metadata_cache = _sql_runtime._tier_caches["metadata"]
_metadata_cache_lock = _sql_runtime.cache_lock
_scorecard_cache = _sql_runtime._tier_caches["scorecard"]
_scorecard_cache_lock = _sql_runtime.cache_lock
_chart_cache = _sql_runtime._tier_caches["chart"]
_chart_cache_lock = _sql_runtime.cache_lock

_freshness_runtime = DataFreshnessRuntime(
    run_sql=lambda token, statement, params=None: run_sql(token, statement, params),
    catalog=lambda: TRACE_CATALOG,
    schema=lambda: TRACE_SCHEMA,
)


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
    bypass_cache: bool = False,
) -> list[dict]:
    is_query_audit_statement = _is_query_audit_statement(statement)
    async with _SQL_SEMAPHORE:
        return await _sql_runtime.run_sql_async(
            token,
            statement,
            params,
            endpoint_hint=endpoint_hint,
            audit=audit and not is_query_audit_statement,
            invalidate_cache=not is_query_audit_statement,
            bypass_cache=bypass_cache,
        )


# ---------------------------------------------------------------------------
# Data freshness
# ---------------------------------------------------------------------------
def get_data_freshness(token: str, source_views: list[str]) -> dict:
    return _freshness_runtime.get_data_freshness(token, source_views)


# ---------------------------------------------------------------------------
# Audit helpers — logic lives in process_control/dal/query_audit.py
# These re-exports preserve the existing public names consumed by tests and
# by attach_data_freshness below.
# ---------------------------------------------------------------------------
from spc_backend.process_control.dal.query_audit import (  # noqa: E402
    insert_spc_audit_event,
    insert_spc_query_audit,
    insert_spc_exclusion_snapshot,
)


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


