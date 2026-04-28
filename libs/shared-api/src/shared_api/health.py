"""
Health and readiness utilities for shared-api.

Provides standardized payloads and connectivity checks for FastAPI services,
particularly focusing on Databricks SQL connectivity.
"""
from __future__ import annotations

import inspect
import os
from collections.abc import Callable
from typing import Any

from fastapi import HTTPException


CheckWarehouseConfig = Callable[[], Any]
RunSql = Callable[..., Any]


def health_payload() -> dict[str, str]:
    """Returns a simple health status payload."""
    return {"status": "ok"}


def readiness_token_from_env(env_var: str = "DATABRICKS_READINESS_TOKEN") -> str:
    """Extracts the readiness token from the environment."""
    return os.environ.get(env_var, "").strip()


def not_ready(reason: str, *, message: Any | None = None) -> HTTPException:
    """Helper to create a consistent 503 Not Ready exception."""
    detail: dict[str, Any] = {"status": "not_ready", "reason": reason}
    if message is not None:
        detail["message"] = message
    return HTTPException(status_code=503, detail=detail)


async def maybe_await(value: Any) -> Any:
    """Await a value if it is awaitable, otherwise return it as is."""
    if inspect.isawaitable(value):
        return await value
    return value


def accepts_keyword(func: RunSql, name: str) -> bool:
    """Check if a function signature accepts a specific keyword argument."""
    try:
        signature = inspect.signature(func)
    except (TypeError, ValueError):
        return False
    return any(
        parameter.kind == inspect.Parameter.VAR_KEYWORD or parameter.name == name
        for parameter in signature.parameters.values()
    )


async def databricks_sql_ready(
    *,
    check_warehouse_config: CheckWarehouseConfig,
    run_sql: RunSql,
    query: str = "SELECT 1 AS ok",
    endpoint_hint: str | None = None,
    include_sample_result: bool = False,
    warehouse_config_message: Any | None = None,
    readiness_token_message: str | None = None,
    sql_error_message: str | None = None,
) -> dict[str, Any]:
    """
    Check if the Databricks SQL warehouse is ready and reachable.

    Args:
        check_warehouse_config: Callable to verify warehouse configuration.
        run_sql: Callable to execute a SQL query.
        query: The SQL query to run for the readiness check.
        endpoint_hint: Optional hint for the query execution.
        include_sample_result: Whether to include the first row of the query result.
        warehouse_config_message: Custom message for configuration errors.
        readiness_token_message: Custom message for missing readiness token.
        sql_error_message: Custom message for SQL execution errors.

    Returns:
        A dictionary containing the readiness status and checks performed.

    Raises:
        HTTPException: 503 if the warehouse is not ready.
    """
    try:
        check_warehouse_config()
    except HTTPException as exc:
        raise not_ready(
            "warehouse_config_missing",
            message=warehouse_config_message if warehouse_config_message is not None else exc.detail,
        ) from exc

    readiness_token = readiness_token_from_env()
    if not readiness_token:
        raise not_ready("readiness_token_missing", message=readiness_token_message)

    try:
        if endpoint_hint is not None and accepts_keyword(run_sql, "endpoint_hint"):
            rows = await maybe_await(run_sql(readiness_token, query, endpoint_hint=endpoint_hint))
        else:
            rows = await maybe_await(run_sql(readiness_token, query))
    except Exception as exc:
        raise not_ready("sql_warehouse_unreachable", message=sql_error_message) from exc

    payload: dict[str, Any] = {
        "status": "ready",
        "checks": {"config": "ok", "sql_warehouse": "ok"},
    }
    if include_sample_result:
        payload["sample_result"] = rows[0] if rows else None
    return payload
