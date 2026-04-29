"""POH-specific database utilities.

Wraps shared_db with a local tbl() that reads POH_CATALOG / POH_SCHEMA
environment variables instead of TRACE_CATALOG / TRACE_SCHEMA, keeping
this app's schema reference independent of the trace/SPC apps.

Timezone helpers
----------------
``validate_timezone`` checks an IANA timezone name against the zoneinfo
database and falls back to ``'UTC'`` for unknown values.

``tz_day_ms``, ``tz_hour_ms``, and ``tz_date`` return SQL expression
fragments that convert UTC timestamps to local-time calendar boundaries or
dates.  All three accept a ``tz`` argument that **must** come from
``validate_timezone`` — the value is interpolated directly into the SQL
fragment, which is safe because zoneinfo restricts IANA names to letters,
digits, underscores, hyphens, and forward slashes (no SQL metacharacters).
"""
import os
from typing import Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

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


def validate_timezone(tz: Optional[str]) -> str:
    """Validate an IANA timezone name, returning ``'UTC'`` for invalid or missing values."""
    if not tz:
        return "UTC"
    try:
        ZoneInfo(tz)
        return tz
    except (ZoneInfoNotFoundError, KeyError):
        return "UTC"


def tz_day_ms(col: str, tz: str) -> str:
    """SQL fragment: UTC epoch-ms for the start of the local calendar day containing ``col``.

    ``col`` must be a UTC TIMESTAMP column.  ``tz`` must be a value returned by
    ``validate_timezone`` — it is interpolated without escaping.
    """
    return (
        f"CAST(UNIX_TIMESTAMP(CONVERT_TIMEZONE('{tz}', 'UTC', "
        f"DATE_TRUNC('day', CONVERT_TIMEZONE('UTC', '{tz}', {col})))) * 1000 AS BIGINT)"
    )


def tz_hour_ms(col: str, tz: str) -> str:
    """SQL fragment: UTC epoch-ms for the start of the local calendar hour containing ``col``.

    ``col`` must be a UTC TIMESTAMP column.  ``tz`` must be a value returned by
    ``validate_timezone``.
    """
    return (
        f"CAST(UNIX_TIMESTAMP(CONVERT_TIMEZONE('{tz}', 'UTC', "
        f"DATE_TRUNC('hour', CONVERT_TIMEZONE('UTC', '{tz}', {col})))) * 1000 AS BIGINT)"
    )


def tz_date(col: str, tz: str) -> str:
    """SQL fragment: local calendar date (DATE type) of a UTC TIMESTAMP column.

    ``tz`` must be a value returned by ``validate_timezone``.
    """
    return f"DATE(CONVERT_TIMEZONE('UTC', '{tz}', {col}))"


ORDER_STATUS_EXPR = """
    CASE po.STATUS
        WHEN 'IN PROGRESS'            THEN 'running'
        WHEN 'Tulip Load In Progress' THEN 'running'
        WHEN 'COMPLETED'              THEN 'completed'
        WHEN 'CLOSED'                 THEN 'completed'
        WHEN 'ON HOLD'                THEN 'onhold'
        WHEN 'CANCELLED'              THEN 'cancelled'
        ELSE 'released'
    END
""".strip()
