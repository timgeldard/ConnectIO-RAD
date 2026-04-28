"""POH-specific database utilities.

Wraps shared_db with a local tbl() that reads POH_CATALOG / POH_SCHEMA
environment variables instead of TRACE_CATALOG / TRACE_SCHEMA, keeping
this app's schema reference independent of the trace/SPC apps.
"""
import os
from typing import Optional

from shared_db.core import (  # noqa: F401 — re-exported for dal imports
    check_warehouse_config,
    resolve_token,
    run_sql_async as _shared_run_sql_async,
    sql_param,
)

POH_CATALOG: str = os.environ.get("POH_CATALOG", "connected_plant_uat")
POH_SCHEMA: str = os.environ.get("POH_SCHEMA", "csm_process_order_history")


def tbl(name: str) -> str:
    """Return a fully-qualified backtick-quoted table reference for this app's schema."""
    return f"`{POH_CATALOG}`.`{POH_SCHEMA}`.`{name}`"


def silver_tbl(name: str) -> str:
    """Return a fully-qualified backtick-quoted table reference for the silver schema."""
    return f"`{POH_CATALOG}`.`silver`.`{name}`"


async def run_sql_async(
    token: str,
    statement: str,
    params: Optional[list[dict]] = None,
    *,
    endpoint_hint: str = "unknown",
) -> list[dict]:
    """Execute a SQL statement using the shared 300-second TTL-cached async executor."""
    return await _shared_run_sql_async(token, statement, params)
