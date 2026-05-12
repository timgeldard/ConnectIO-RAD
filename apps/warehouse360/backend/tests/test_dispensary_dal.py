import pytest
from unittest.mock import AsyncMock
from shared_manufacturing import test_data
from warehouse360_backend.dispensary_ops.dal import dispensary


@pytest.mark.asyncio
async def test_fetch_dispensary_tasks_no_plant(monkeypatch):
    mock_run = AsyncMock(return_value=[])
    monkeypatch.setattr(dispensary, "run_sql_async", mock_run)
    
    await dispensary.fetch_dispensary_tasks("token")
    assert "wh360_dispensary_tasks_v" in mock_run.call_args[0][1]
    assert "WHERE" not in mock_run.call_args[0][1]


@pytest.mark.asyncio
async def test_fetch_dispensary_tasks_with_plant(monkeypatch):
    mock_run = AsyncMock(return_value=[])
    monkeypatch.setattr(dispensary, "run_sql_async", mock_run)
    plant = test_data.PLANTS[0]
    
    await dispensary.fetch_dispensary_tasks("token", plant_id=plant)
    assert "WHERE plant_id = :plant_id" in mock_run.call_args[0][1]
    assert mock_run.call_args[0][2][0]["value"] == plant
