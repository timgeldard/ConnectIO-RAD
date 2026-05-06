"""
Shared DAL utilities for Trace2.
"""

from functools import lru_cache

from shared_trace.dal import TraceCoreDal
from trace2_backend.utils.db import run_sql_async, sql_param, tbl


@lru_cache(maxsize=1)
def get_trace_core_dal() -> TraceCoreDal:
    """Returns a module-level TraceCoreDal singleton, constructed once and cached."""
    return TraceCoreDal(run_sql_async=run_sql_async, tbl=tbl, sql_param=sql_param)
