"""
Shared DAL utilities for Trace2.
"""

from shared_trace.dal import TraceCoreDal
from trace2_backend.utils.db import run_sql_async, sql_param, tbl

_instance = None

def get_trace_core_dal() -> TraceCoreDal:
    """
    Returns an instance of TraceCoreDal configured for Trace2.
    Uses a singleton pattern to ensure all contexts share the same instance.
    """
    global _instance
    if _instance is None:
        _instance = TraceCoreDal(run_sql_async=run_sql_async, tbl=tbl, sql_param=sql_param)
    return _instance
