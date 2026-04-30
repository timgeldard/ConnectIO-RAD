"""Unit tests for backend/db.py — validate_timezone and run_sql_async."""
import asyncio
from unittest.mock import AsyncMock

import backend.db as db


# ---------------------------------------------------------------------------
# validate_timezone
# ---------------------------------------------------------------------------

def test_validate_timezone_returns_valid_iana_name():
    assert db.validate_timezone("America/New_York") == "America/New_York"


def test_validate_timezone_returns_utc_name_unchanged():
    assert db.validate_timezone("UTC") == "UTC"


def test_validate_timezone_returns_utc_for_none():
    assert db.validate_timezone(None) == "UTC"


def test_validate_timezone_returns_utc_for_empty_string():
    assert db.validate_timezone("") == "UTC"


def test_validate_timezone_returns_utc_for_invalid_name():
    assert db.validate_timezone("Not/A/Timezone") == "UTC"


def test_validate_timezone_returns_utc_for_unknown_zone():
    assert db.validate_timezone("Mars/Olympus_Mons") == "UTC"


# ---------------------------------------------------------------------------
# run_sql_async — endpoint_hint is dropped before forwarding
# ---------------------------------------------------------------------------

def test_run_sql_async_calls_shared_without_endpoint_hint(monkeypatch):
    expected = [{"col": "val"}]
    mock = AsyncMock(return_value=expected)
    monkeypatch.setattr(db, "_shared_run_sql_async", mock)
    result = asyncio.run(db.run_sql_async("tok", "SELECT 1", endpoint_hint="test.hint"))
    mock.assert_called_once_with("tok", "SELECT 1", None)
    assert result == expected


def test_run_sql_async_forwards_params(monkeypatch):
    params = [{"name": "id", "value": "PO-001"}]
    mock = AsyncMock(return_value=[])
    monkeypatch.setattr(db, "_shared_run_sql_async", mock)
    asyncio.run(db.run_sql_async("tok", "SELECT 1 WHERE id = :id", params))
    mock.assert_called_once_with("tok", "SELECT 1 WHERE id = :id", params)


def test_run_sql_async_returns_shared_result(monkeypatch):
    expected = [{"a": 1}, {"a": 2}]
    monkeypatch.setattr(db, "_shared_run_sql_async", AsyncMock(return_value=expected))
    result = asyncio.run(db.run_sql_async("tok", "SELECT a"))
    assert result == expected
