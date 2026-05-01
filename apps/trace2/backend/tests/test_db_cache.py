import asyncio

import backend.utils.db as db_module


def _clear_cache() -> None:
    db_module._clear_sql_cache()


def test_read_statements_are_cached(monkeypatch):
    _clear_cache()
    calls = []

    def fake_run_sql(token, statement, params=None):
        calls.append((token, statement, params))
        return [{"ok": len(calls)}]

    monkeypatch.setattr(db_module, "run_sql", fake_run_sql)

    first = asyncio.run(db_module.run_sql_async("token", "SELECT 1 AS ok"))
    second = asyncio.run(db_module.run_sql_async("token", "SELECT 1 AS ok"))

    assert first == [{"ok": 1}]
    assert second == [{"ok": 1}]
    assert len(calls) == 1


def test_write_statements_are_not_cached(monkeypatch):
    _clear_cache()
    calls = []

    def fake_run_sql(token, statement, params=None):
        calls.append((token, statement, params))
        return [{"write": len(calls)}]

    monkeypatch.setattr(db_module, "run_sql", fake_run_sql)

    first = asyncio.run(db_module.run_sql_async("token", "INSERT INTO table_name SELECT 1"))
    second = asyncio.run(db_module.run_sql_async("token", "INSERT INTO table_name SELECT 1"))

    assert first == [{"write": 1}]
    assert second == [{"write": 2}]
    assert len(calls) == 2


def test_write_statements_clear_read_cache(monkeypatch):
    _clear_cache()
    calls = []

    def fake_run_sql(token, statement, params=None):
        calls.append(statement)
        if statement.startswith("SELECT"):
            return [{"read": calls.count(statement)}]
        return [{"write": True}]

    monkeypatch.setattr(db_module, "run_sql", fake_run_sql)

    first_read = asyncio.run(db_module.run_sql_async("token", "SELECT 1 AS ok"))
    asyncio.run(db_module.run_sql_async("token", "UPDATE table_name SET value = 1"))
    second_read = asyncio.run(db_module.run_sql_async("token", "SELECT 1 AS ok"))

    assert first_read == [{"read": 1}]
    assert second_read == [{"read": 2}]
    assert calls == [
        "SELECT 1 AS ok",
        "UPDATE table_name SET value = 1",
        "SELECT 1 AS ok",
    ]
