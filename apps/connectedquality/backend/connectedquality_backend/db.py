"""ConnectedQuality database utilities.

Thin wrapper over shared_db — re-exports the helpers needed by the readiness
probe and any future DAL modules in this app.
"""

import os
from functools import lru_cache
from typing import Optional

from shared_db.core import (  # noqa: F401 — re-exported
    check_warehouse_config,
    resolve_token,
    run_sql,
    run_sql_async as _shared_run_sql_async,
    sql_param,
    tbl as shared_tbl,
)
from shared_db.runtime import get_semaphore
from shared_trace.dal import TraceCoreDal

CQ_CATALOG: str = os.environ.get("CQ_CATALOG", os.environ.get("TRACE_CATALOG", ""))
CQ_SCHEMA: str = os.environ.get("CQ_SCHEMA", os.environ.get("POH_SCHEMA", "csm_process_order_history"))


def tbl(name: str) -> str:
    """Return a fully-qualified backtick-quoted ConnectedQuality table reference.

    Args:
        name: Table or view name within the configured ConnectedQuality schema.

    Returns:
        Fully-qualified Unity Catalog table reference using ``CQ_CATALOG`` and
        ``CQ_SCHEMA``.
    """
    return f"`{CQ_CATALOG}`.`{CQ_SCHEMA}`.`{name}`"


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
    async with get_semaphore("cq"):
        return await _shared_run_sql_async(token, statement, params)


@lru_cache(maxsize=1)
def get_trace_core_dal() -> TraceCoreDal:
    """Return the module-level TraceCoreDal singleton for CQ trace routes.

    Uses the shared gold-layer ``tbl`` resolver (TRACE_CATALOG/TRACE_SCHEMA)
    so the lineage views are resolved correctly, and CQ's own ``run_sql_async``
    for concurrency control.
    """
    return TraceCoreDal(
        run_sql_async=run_sql_async,
        tbl=shared_tbl,
        sql_param=sql_param,
    )
