"""Unit tests for shared_db.authorized_scope."""
from unittest.mock import patch

import pytest

from shared_db.authorized_scope import fetch_authorized_plants


@pytest.fixture()
def mock_run_sql():
    """Patch run_sql_async so no real Databricks connection is needed."""
    with patch("shared_db.authorized_scope.run_sql_async") as m:
        yield m


@pytest.mark.asyncio
async def test_returns_sorted_plant_ids(mock_run_sql):
    """Plants are returned as a sorted list of strings."""
    mock_run_sql.return_value = [
        {"PLANT_ID": "ZZZ"},
        {"PLANT_ID": "AAA"},
        {"PLANT_ID": "MMM"},
    ]
    result = await fetch_authorized_plants("tok")
    assert result == ["AAA", "MMM", "ZZZ"]


@pytest.mark.asyncio
async def test_empty_result_when_no_plants(mock_run_sql):
    """Returns empty list when gold_plant returns no rows for the user."""
    mock_run_sql.return_value = []
    result = await fetch_authorized_plants("tok")
    assert result == []


@pytest.mark.asyncio
async def test_filters_null_plant_ids(mock_run_sql):
    """Rows with a null PLANT_ID are silently dropped."""
    mock_run_sql.return_value = [
        {"PLANT_ID": "RCN1"},
        {"PLANT_ID": None},
        {"PLANT_ID": ""},
    ]
    result = await fetch_authorized_plants("tok")
    assert result == ["RCN1"]


@pytest.mark.asyncio
async def test_uses_default_catalog_schema(mock_run_sql):
    """Query uses TRACE_CATALOG / TRACE_SCHEMA when no overrides are given."""
    mock_run_sql.return_value = []
    await fetch_authorized_plants("tok")
    sql: str = mock_run_sql.call_args[0][1]
    assert "gold_plant" in sql


@pytest.mark.asyncio
async def test_catalog_schema_override(mock_run_sql):
    """Explicit catalog/schema overrides are injected into the SQL."""
    mock_run_sql.return_value = []
    await fetch_authorized_plants("tok", catalog="my_cat", schema="my_schema")
    sql: str = mock_run_sql.call_args[0][1]
    assert "my_cat" in sql
    assert "my_schema" in sql


@pytest.mark.asyncio
async def test_endpoint_hint_passed(mock_run_sql):
    """endpoint_hint is forwarded so warehouse logs capture the caller."""
    mock_run_sql.return_value = []
    await fetch_authorized_plants("tok")
    kwargs = mock_run_sql.call_args[1]
    assert kwargs.get("endpoint_hint") == "shared.authorized_scope"
