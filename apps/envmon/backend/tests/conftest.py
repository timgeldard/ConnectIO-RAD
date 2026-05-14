"""Test configuration and shared_db stub for local testing.

shared_db is a private Databricks library not available outside the Databricks
environment. This conftest provides minimal stubs so that modules that import
shared_db can be collected and tested with mocked DAL layers.
"""

from __future__ import annotations

import sys
import types


def _make_stub(name: str, **attrs) -> types.ModuleType:
    mod = types.ModuleType(name)
    for k, v in attrs.items():
        setattr(mod, k, v)
    sys.modules[name] = mod
    return mod


# Only stub if shared_db is genuinely absent (don't override a real install)
if "shared_db" not in sys.modules:
    async def _noop_async(*args, **kwargs):  # type: ignore[return]
        return []

    def _noop_sync(*args, **kwargs):  # type: ignore[return]
        return []

    def _run_sql_in(values, *, prefix="p"):  # type: ignore[no-untyped-def]
        if not values:
            return "NULL", []
        placeholders = ", ".join(f":{prefix}{idx}" for idx in range(len(values)))
        params = [
            {"name": f"{prefix}{idx}", "value": value, "type": "STRING"}
            for idx, value in enumerate(values)
        ]
        return placeholders, params

    class _TTLCache:  # type: ignore[no-untyped-def]
        def __init__(self, *a, **k): pass
        def get(self, *a, **k): return None
        def set(self, *a, **k): pass
        def clear(self): pass

    class _CachePolicy:
        @staticmethod
        def manufacturing():
            return _CachePolicy()

    class _SqlRuntime:  # type: ignore[no-untyped-def]
        def __init__(self, *a, **k):
            self.cache = _TTLCache()
            self.cache_lock = None
            self.cache_row_limit = 10_000

        def clear_cache(self): pass

        async def run_sql_async(self, *a, **k):
            return []

    class _DataFreshnessRuntime:  # type: ignore[no-untyped-def]
        def __init__(self, *a, **k): pass

        def get_data_freshness(self, *a, **k): return {}

    class _Executor:  # type: ignore[no-untyped-def]
        def execute(self, *a, **k): return []

    _REST_EXECUTOR_stub = _Executor()
    _CONNECTOR_EXECUTOR_stub = _Executor()

    def _sql_executor_stub(*a, **k): return _REST_EXECUTOR_stub  # type: ignore[return]

    _make_stub(
        "shared_db.core",
        DATABRICKS_HOST="http://localhost",
        WAREHOUSE_HTTP_PATH="/test",
        TRACE_CATALOG="test_cat",
        TRACE_SCHEMA="gold",
        hostname="localhost",
        tbl=lambda *a, **k: a[0] if a else "test_table",
        check_warehouse_config=_noop_sync,
        resolve_token=lambda *a, **k: "test-token",
        sql_param=lambda name, value: {"name": name, "value": value, "type": "STRING"},
        run_sql_in=_run_sql_in,
        TTLCache=_TTLCache,
    )

    _make_stub(
        "shared_db.errors",
        classify_sql_runtime_error=lambda *a, **k: None,
        increment_observability_counter=_noop_sync,
        send_operational_alert=_noop_sync,
    )

    _make_stub(
        "shared_db.executors",
        _sql_executor=_sql_executor_stub,
        _REST_EXECUTOR=_REST_EXECUTOR_stub,
        _CONNECTOR_EXECUTOR=_CONNECTOR_EXECUTOR_stub,
    )

    _make_stub(
        "shared_db.freshness",
        DataFreshnessRuntime=_DataFreshnessRuntime,
    )

    _make_stub(
        "shared_db.runtime",
        SqlRuntime=_SqlRuntime,
        CachePolicy=_CachePolicy,
        is_read_only_statement=lambda *a: True,
        is_write_statement=lambda *a: False,
        sql_cache_key=lambda *a: "key",
    )

    _make_stub("shared_db", run_sql_in=_run_sql_in)
    _make_stub("shared_auth", require_proxy_user=_noop_sync)
    _make_stub("shared_auth.models")
    _make_stub("shared_auth.deps")
    _make_stub("shared_ddd", ValueObject=object, Entity=object,
               BusinessRuleValidationException=ValueError)
    _make_stub("shared_manufacturing")
    _make_stub("shared_manufacturing.test_data")
    _make_stub("shared_api")
    _make_stub("shared_geo")
