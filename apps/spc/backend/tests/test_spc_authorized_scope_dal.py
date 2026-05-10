"""Unit tests for spc_backend.process_control.dal.authorized_scope."""
import asyncio
from unittest.mock import AsyncMock, patch

import pytest

from spc_backend.process_control.dal.authorized_scope import fetch_authorized_plants


@pytest.fixture()
def mock_run_sql():
    with patch(
        "spc_backend.process_control.dal.authorized_scope.run_sql_async",
        new_callable=AsyncMock,
    ) as m:
        yield m


def test_returns_sorted_plant_ids(mock_run_sql):
    """Plants come back as a sorted list of strings regardless of DB order."""
    mock_run_sql.return_value = [
        {"PLANT_ID": "ZZZ"},
        {"PLANT_ID": "AAA"},
        {"PLANT_ID": "MMM"},
    ]
    result = asyncio.run(fetch_authorized_plants("tok"))
    assert result == ["AAA", "MMM", "ZZZ"]


def test_empty_when_no_plants(mock_run_sql):
    """Returns an empty list when gold_plant returns no rows."""
    mock_run_sql.return_value = []
    result = asyncio.run(fetch_authorized_plants("tok"))
    assert result == []


from shared_domain import test_data

def test_filters_null_plant_ids(mock_run_sql):
    """Rows with a null or empty PLANT_ID are silently dropped."""
    plant = test_data.PLANTS[0]
    mock_run_sql.return_value = [
        {"PLANT_ID": plant},
        {"PLANT_ID": None},
        {"PLANT_ID": ""},
    ]
    result = asyncio.run(fetch_authorized_plants("tok"))
    assert result == [plant]


def test_uses_gold_plant_table(mock_run_sql):
    """The query targets gold_plant."""
    mock_run_sql.return_value = []
    asyncio.run(fetch_authorized_plants("tok"))
    sql: str = mock_run_sql.call_args[0][1]
    assert "gold_plant" in sql


def test_endpoint_hint_passed(mock_run_sql):
    """endpoint_hint is forwarded for observability."""
    mock_run_sql.return_value = []
    asyncio.run(fetch_authorized_plants("tok"))
    kwargs = mock_run_sql.call_args[1]
    assert kwargs.get("endpoint_hint") == "spc.authorized_scope"
