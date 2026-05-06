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
    sql_param,
    tbl,
)
from shared_db.executors import _sql_executor, _REST_EXECUTOR

CQ_CATALOG: str = os.environ.get("CQ_CATALOG", os.environ.get("TRACE_CATALOG", "connected_plant_uat"))
CQ_SCHEMA: str = os.environ.get("CQ_SCHEMA", os.environ.get("TRACE_SCHEMA", "gold"))

_SQL_CONCURRENCY_LIMIT = int(os.environ.get("SQL_CONCURRENCY_LIMIT", "4"))
_SQL_SEMAPHORE = asyncio.Semaphore(_SQL_CONCURRENCY_LIMIT)


async def run_sql_async(
    token: str,
    statement: str,
    params: Optional[list[dict]] = None,
    *,
    endpoint_hint: str = "cq.unknown",
) -> list[dict]:
    """Execute a SQL statement asynchronously, with concurrency limiting."""
    async with _SQL_SEMAPHORE:
        return await asyncio.get_running_loop().run_in_executor(
            _sql_executor,
            lambda: _REST_EXECUTOR.execute(token, statement, params),
        )
