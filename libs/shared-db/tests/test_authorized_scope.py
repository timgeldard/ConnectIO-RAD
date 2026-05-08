"""Unit tests for shared_db.authorized_scope."""
from unittest.mock import patch

import pytest
from fastapi import HTTPException

from shared_db.authorized_scope import assert_plant_authorized, fetch_authorized_plants


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


# ---------------------------------------------------------------------------
# assert_plant_authorized tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_assert_authorized_no_op_when_plant_id_none(mock_run_sql):
    """No database call is made when plant_id is None (global scope)."""
    await assert_plant_authorized("tok", None)
    mock_run_sql.assert_not_called()


@pytest.mark.asyncio
async def test_assert_authorized_passes_when_plant_in_scope(mock_run_sql):
    """No exception raised when the plant is in the authorized set."""
    mock_run_sql.return_value = [{"PLANT_ID": "IE01"}, {"PLANT_ID": "DE01"}]
    await assert_plant_authorized("tok", "IE01")  # should not raise


@pytest.mark.asyncio
async def test_assert_authorized_raises_403_when_plant_not_in_scope(mock_run_sql):
    """HTTPException 403 is raised when the plant is not authorized."""
    mock_run_sql.return_value = [{"PLANT_ID": "IE01"}]
    with pytest.raises(HTTPException) as exc_info:
        await assert_plant_authorized("tok", "DE01")
    assert exc_info.value.status_code == 403
    assert "DE01" in exc_info.value.detail
