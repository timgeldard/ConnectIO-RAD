"""ConnectedQuality database utilities.

Thin wrapper over shared_db — re-exports the helpers needed by the readiness
probe and any future DAL modules in this app.
"""

import asyncio
import os
from typing import Optional

from shared_db.core import (  # noqa: F401 — re-exported
    check_warehouse_config,
    resolve_token,
    run_sql,
    run_sql_async as _shared_run_sql_async,
    sql_param,
    tbl,
)

CQ_CATALOG: str = os.environ.get("CQ_CATALOG", os.environ.get("TRACE_CATALOG", "connected_plant_uat"))
CQ_SCHEMA: str = os.environ.get("CQ_SCHEMA", os.environ.get("TRACE_SCHEMA", "gold"))

_SQL_CONCURRENCY_LIMIT = int(os.environ.get("SQL_CONCURRENCY_LIMIT", "4"))
_SQL_SEMAPHORE = asyncio.Semaphore(_SQL_CONCURRENCY_LIMIT)


async def run_sql_async(
    token: str,
    statement: str,
    params: Optional[list[dict]] = None,
) -> list[dict]:
    """Execute a SQL statement asynchronously with concurrency limiting.

    Wraps the shared run_sql_async with a semaphore to cap the number of
    in-flight Databricks SQL requests from this app.

    Args:
        token: Databricks access token forwarded from the request.
        statement: Parameterised SQL to execute.
        params: Optional positional parameter list for the statement.

    Returns:
        List of row dicts returned by the warehouse.
    """
    async with _SQL_SEMAPHORE:
        return await _shared_run_sql_async(token, statement, params)
