import asyncio

from shared_db.freshness import DataFreshnessRuntime
from shared_db.runtime import (
    CachePolicy,
    CacheTier,
    SqlRuntime,
    SqlRuntimeConfig,
    is_read_only_statement,
    is_write_statement,
    sql_cache_key,
)


def test_statement_classification():
    assert is_read_only_statement("SELECT 1")
    assert is_read_only_statement("  WITH cte AS (SELECT 1) SELECT * FROM cte")
    assert is_read_only_statement("-- warmup\nSELECT 1")
    assert is_read_only_statement("/* warmup */\nSELECT 1")
    assert is_write_statement("INSERT INTO t VALUES (1)")
    assert is_write_statement("UPDATE t SET value = 1")
    assert not is_read_only_statement("INSERT INTO t VALUES (1)")


def test_sql_runtime_caches_read_statements():
    calls = []

    def run_sql(token, statement, params=None):
        calls.append((token, statement, params))
        return [{"ok": len(calls)}]

    runtime = SqlRuntime(run_sql=run_sql)

    first = asyncio.run(runtime.run_sql_async("token", "SELECT 1 AS ok"))
    second = asyncio.run(runtime.run_sql_async("token", "SELECT 1 AS ok"))

    assert first == [{"ok": 1}]
    assert second == [{"ok": 1}]
    assert len(calls) == 1


def test_sql_runtime_does_not_cache_writes_and_clears_read_cache():
    calls = []

    def run_sql(_token, statement, params=None):
        calls.append(statement)
        if statement.startswith("SELECT"):
            return [{"read": calls.count(statement)}]
        return [{"write": True}]

    runtime = SqlRuntime(run_sql=run_sql)

    first_read = asyncio.run(runtime.run_sql_async("token", "SELECT 1 AS ok"))
    asyncio.run(runtime.run_sql_async("token", "UPDATE t SET value = 1"))
    second_read = asyncio.run(runtime.run_sql_async("token", "SELECT 1 AS ok"))

    assert first_read == [{"read": 1}]
    assert second_read == [{"read": 2}]
    assert calls == ["SELECT 1 AS ok", "UPDATE t SET value = 1", "SELECT 1 AS ok"]


def test_sql_cache_key_includes_params():
    left = sql_cache_key("token", "SELECT :value", [{"name": "value", "value": "1"}])
    right = sql_cache_key("token", "SELECT :value", [{"name": "value", "value": "2"}])

    assert left != right


def test_sql_runtime_accepts_endpoint_hint_and_audit_hook():
    audit_events = []

    def run_sql(_token, statement, params=None):
        return [{"statement": statement, "params": params}]

    async def audit_hook(**event):
        audit_events.append(event)

    runtime = SqlRuntime(run_sql=run_sql, audit_hook=audit_hook)

    asyncio.run(runtime.run_sql_async("token", "SELECT 1 AS ok", endpoint_hint="test.endpoint"))

    assert audit_events[0]["endpoint_hint"] == "test.endpoint"
    assert audit_events[0]["rows"] == [{"statement": "SELECT 1 AS ok", "params": None}]


def test_sql_runtime_supports_tiered_cache_policy():
    calls = []

    def run_sql(_token, statement, params=None):
        calls.append(statement)
        return [{"ok": len(calls)}]

    runtime = SqlRuntime(
        run_sql=run_sql,
        cache_policy=CachePolicy.tiered(
            CacheTier("metadata", maxsize=10, ttl_seconds=300, row_limit=10, prefixes=("SHOW", "DESCRIBE")),
            CacheTier("reads", maxsize=10, ttl_seconds=300, row_limit=10, prefixes=("SELECT", "WITH")),
        ),
    )

    first = asyncio.run(runtime.run_sql_async("token", "SHOW TABLES"))
    second = asyncio.run(runtime.run_sql_async("token", "SHOW TABLES"))

    assert first == second
    assert calls == ["SHOW TABLES"]


def test_sql_runtime_supports_pattern_matched_cache_tiers_and_invalidation_opt_out():
    calls = []

    def run_sql(_token, statement, params=None):
        calls.append(statement)
        return [{"call": len(calls), "params": params}]

    runtime = SqlRuntime(
        run_sql=run_sql,
        cache_policy=CachePolicy.tiered(
            CacheTier("scorecard", patterns=("spc_quality_metrics",)),
            CacheTier("chart"),
        ),
    )

    first = asyncio.run(runtime.run_sql_async("token", "SELECT * FROM spc_quality_metrics"))
    second = asyncio.run(runtime.run_sql_async("token", "SELECT * FROM spc_quality_metrics"))
    asyncio.run(runtime.run_sql_async("token", "INSERT INTO spc_query_audit SELECT 1", invalidate_cache=False))
    third = asyncio.run(runtime.run_sql_async("token", "SELECT * FROM spc_quality_metrics"))

    assert first == second == third
    assert calls == ["SELECT * FROM spc_quality_metrics", "INSERT INTO spc_query_audit SELECT 1"]


def test_sql_runtime_config_builds_runtime_with_policy_and_audit_options():
    audit_events = []

    def run_sql(_token, statement, _params=None):
        return [{"statement": statement}]

    async def audit_hook(**event):
        audit_events.append(event)

    runtime = SqlRuntimeConfig(
        run_sql=run_sql,
        cache_policy=CachePolicy.tiered(CacheTier("reads")),
        audit_hook=audit_hook,
    ).build()

    rows = asyncio.run(runtime.run_sql_async("token", "SELECT 1", endpoint_hint="config-test"))

    assert rows == [{"statement": "SELECT 1"}]
    assert audit_events[0]["endpoint_hint"] == "config-test"


def test_data_freshness_runtime_filters_views_and_caches():
    calls = []

    def run_sql(_token, _statement, params=None):
        calls.append(params)
        return [{"source_view": "gold_batch_stock_v"}]

    runtime = DataFreshnessRuntime(
        run_sql=run_sql,
        catalog=lambda: "catalog",
        schema=lambda: "schema",
    )

    first = runtime.get_data_freshness("token", ["bad-view", "gold_batch_stock_v"])
    second = runtime.get_data_freshness("token", ["gold_batch_stock_v"])

    assert first["sources"] == [{"source_view": "gold_batch_stock_v"}]
    assert second["sources"] == [{"source_view": "gold_batch_stock_v"}]
    assert len(calls) == 1
    assert [param["name"] for param in calls[0]] == ["catalog_name", "schema_name", "view_0"]
