import pytest
from unittest.mock import AsyncMock
from warehouse360_backend.inventory_management.dal import plants


@pytest.mark.asyncio
async def test_fetch_plants(monkeypatch):
    mock_run = AsyncMock(return_value=[{"plant_id": "C351", "plant_name": "Kerry"}])
    monkeypatch.setattr(plants, "run_sql_async", mock_run)
    
    res = await plants.fetch_plants("token")
    assert res == [{"plant_id": "C351", "plant_name": "Kerry"}]
    assert "UNION ALL" in mock_run.call_args[0][1]
