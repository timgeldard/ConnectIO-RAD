import asyncio
from unittest.mock import MagicMock

import processorderhistory_backend.db as db


def test_validate_timezone_accepts_valid_zone():
    assert db.validate_timezone("Europe/Dublin") == "Europe/Dublin"


def test_validate_timezone_returns_utc_for_missing_zone():
    assert db.validate_timezone(None) == "UTC"


def test_validate_timezone_returns_utc_for_unknown_zone():
    assert db.validate_timezone("Mars/Olympus_Mons") == "UTC"


# ---------------------------------------------------------------------------
# run_sql_async — uses SqlRuntime which delegates to _shared_run_sql
# ---------------------------------------------------------------------------

def test_run_sql_async_calls_shared(monkeypatch):
    expected = [{"col": "val"}]
    mock = MagicMock(return_value=expected)
    monkeypatch.setattr(db, "_shared_run_sql", mock)
    
    result = asyncio.run(db.run_sql_async("tok", "SELECT 1", endpoint_hint="test.hint"))
    
    # SqlRuntime adds the hint to the statement or passes it to the hook
    # But it calls the underlying run_sql exactly as provided
    mock.assert_called_once_with("tok", "SELECT 1", None)
    assert result == expected


def test_run_sql_async_forwards_params(monkeypatch):
    params = [{"name": "id", "value": "PO-001"}]
    mock = MagicMock(return_value=[])
    monkeypatch.setattr(db, "_shared_run_sql", mock)
    
    asyncio.run(db.run_sql_async("tok", "SELECT 1 WHERE id = :id", params))
    mock.assert_called_once_with("tok", "SELECT 1 WHERE id = :id", params)


def test_run_sql_async_returns_shared_result(monkeypatch):
    expected = [{"a": 1}, {"a": 2}]
    monkeypatch.setattr(db, "_shared_run_sql", MagicMock(return_value=expected))
    
    result = asyncio.run(db.run_sql_async("tok", "SELECT a"))
    assert result == expected
