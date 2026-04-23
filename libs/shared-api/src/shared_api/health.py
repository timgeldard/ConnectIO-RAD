from __future__ import annotations

import inspect
import os
from collections.abc import Callable
from typing import Any

from fastapi import HTTPException


CheckWarehouseConfig = Callable[[], Any]
RunSql = Callable[..., Any]


def health_payload() -> dict[str, str]:
    return {"status": "ok"}


def readiness_token_from_env(env_var: str = "DATABRICKS_READINESS_TOKEN") -> str:
    return os.environ.get(env_var, "").strip()


def not_ready(reason: str, *, message: Any | None = None) -> HTTPException:
    detail: dict[str, Any] = {"status": "not_ready", "reason": reason}
    if message is not None:
        detail["message"] = message
    return HTTPException(status_code=503, detail=detail)


async def maybe_await(value: Any) -> Any:
    if inspect.isawaitable(value):
        return await value
    return value


def accepts_keyword(func: RunSql, name: str) -> bool:
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
