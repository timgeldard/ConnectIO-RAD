import asyncio

from shared_db.runtime import CachePolicy, CacheTier, SqlRuntime


def test_shared_sql_runtime_supports_spc_tiered_cache_shape():
    calls = []

    def run_sql(_token, statement, params=None):
        calls.append(statement)
        return [{"call": len(calls), "params": params}]

    runtime = SqlRuntime(
        run_sql=run_sql,
        cache_policy=CachePolicy.tiered(
            CacheTier("metadata", maxsize=50, ttl_seconds=600, row_limit=100, prefixes=("SHOW", "DESCRIBE")),
            CacheTier("scorecard", maxsize=50, ttl_seconds=120, row_limit=1000, prefixes=("SELECT", "WITH")),
            CacheTier("chart", maxsize=50, ttl_seconds=60, row_limit=1000, prefixes=("SELECT", "WITH")),
        ),
    )

    first = asyncio.run(runtime.run_sql_async("token", "SELECT * FROM spc_quality_metrics"))
    second = asyncio.run(runtime.run_sql_async("token", "SELECT * FROM spc_quality_metrics"))

    assert first == second
    assert calls == ["SELECT * FROM spc_quality_metrics"]


def test_shared_sql_runtime_supports_spc_audit_hook_and_audit_suppression():
    audit_events = []

    def run_sql(_token, _statement, _params=None):
        return [{"ok": 1}]

    async def audit_hook(**event):
        audit_events.append(event)

    runtime = SqlRuntime(run_sql=run_sql, audit_hook=audit_hook)

    asyncio.run(
        runtime.run_sql_async(
            "token",
            "SELECT * FROM spc_batch_dim_mv WHERE material_id = :material_id",
            [{"name": "material_id", "value": "MAT-1", "type": "STRING"}],
            endpoint_hint="spc.charts.chart-data",
        )
    )
    asyncio.run(
        runtime.run_sql_async(
            "token",
            "INSERT INTO spc_query_audit SELECT 1",
            endpoint_hint="spc.query-audit",
            audit=False,
        )
    )

    assert len(audit_events) == 1
    assert audit_events[0]["endpoint_hint"] == "spc.charts.chart-data"
    assert audit_events[0]["params"][0]["value"] == "MAT-1"
    assert audit_events[0]["rows"] == [{"ok": 1}]


def test_shared_sql_runtime_write_invalidation_matches_spc_cache_requirement():
    calls = []

    def run_sql(_token, statement, _params=None):
        calls.append(statement)
        if statement.startswith("SELECT"):
            return [{"read": calls.count(statement)}]
        return [{"write": True}]

    runtime = SqlRuntime(run_sql=run_sql)

    first_read = asyncio.run(runtime.run_sql_async("token", "SELECT * FROM spc_batch_dim_mv"))
    asyncio.run(runtime.run_sql_async("token", "INSERT INTO spc_exclusions SELECT 1", audit=False))
    second_read = asyncio.run(runtime.run_sql_async("token", "SELECT * FROM spc_batch_dim_mv"))

    assert first_read == [{"read": 1}]
    assert second_read == [{"read": 2}]
