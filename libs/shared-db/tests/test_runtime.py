import asyncio

from shared_db.freshness import DataFreshnessRuntime
from shared_db.runtime import SqlRuntime, is_read_only_statement, is_write_statement, sql_cache_key


def test_statement_classification():
    assert is_read_only_statement("SELECT 1")
    assert is_read_only_statement("  WITH cte AS (SELECT 1) SELECT * FROM cte")
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
