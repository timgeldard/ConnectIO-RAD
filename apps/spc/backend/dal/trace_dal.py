import os

from shared_trace.dal import TraceCoreDal

from backend.utils.db import run_sql_async, sql_param, tbl

MAX_TRACE_LEVELS: int = int(os.environ.get("MAX_TRACE_LEVELS", "10"))

_trace_core_dal = TraceCoreDal(run_sql_async=run_sql_async, tbl=tbl, sql_param=sql_param)


def _build_tree(rows: list[dict]) -> dict | None:
    return _trace_core_dal.build_tree(rows)


async def fetch_trace_tree(
    token: str,
    material_id: str,
    batch_id: str,
    max_levels: int = MAX_TRACE_LEVELS,
) -> list[dict]:
    return await _trace_core_dal.fetch_trace_tree(token, material_id, batch_id, max_levels)


async def fetch_summary(token: str, batch_id: str) -> dict | None:
    return await _trace_core_dal.fetch_summary(token, batch_id)


async def fetch_batch_details(token: str, material_id: str, batch_id: str) -> dict:
    return await _trace_core_dal.fetch_batch_details(token, material_id, batch_id)


async def fetch_impact(token: str, batch_id: str) -> dict:
    return await _trace_core_dal.fetch_impact(token, batch_id)
