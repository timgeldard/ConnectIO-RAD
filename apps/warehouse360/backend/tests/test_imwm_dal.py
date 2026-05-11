import pytest
from unittest.mock import AsyncMock, patch
from shared_domain import test_data
from warehouse360_backend.inventory_management.dal import imwm


@pytest.mark.asyncio
async def test_fetch_imwm_stock_no_plant(monkeypatch):
    mock_run = AsyncMock(return_value=[{"plant_id": "P1"}])
    monkeypatch.setattr(imwm, "run_sql_async", mock_run)
    
    res = await imwm.fetch_imwm_stock("token")
    assert res == [{"plant_id": "P1"}]
    assert "WHERE plant_id" not in mock_run.call_args[0][1]


@pytest.mark.asyncio
async def test_fetch_imwm_stock_with_plant(monkeypatch):
    mock_run = AsyncMock(return_value=[])
    monkeypatch.setattr(imwm, "run_sql_async", mock_run)
    plant = test_data.PLANTS[0]
    
    await imwm.fetch_imwm_stock("token", plant_id=plant)
    assert "WHERE plant_id = :plant_id" in mock_run.call_args[0][1]
    assert mock_run.call_args[0][2][0]["value"] == plant


@pytest.mark.asyncio
async def test_fetch_imwm_movements(monkeypatch):
    mock_run = AsyncMock(return_value=[])
    monkeypatch.setattr(imwm, "run_sql_async", mock_run)
    
    await imwm.fetch_imwm_movements("token")
    assert "imwm_movements_v" in mock_run.call_args[0][1]


@pytest.mark.asyncio
async def test_fetch_imwm_exceptions(monkeypatch):
    mock_run = AsyncMock(return_value=[])
    monkeypatch.setattr(imwm, "run_sql_async", mock_run)
    
    await imwm.fetch_imwm_exceptions("token")
    assert "imwm_exceptions_v" in mock_run.call_args[0][1]


@pytest.mark.asyncio
async def test_fetch_imwm_aging(monkeypatch):
    mock_run = AsyncMock(return_value=[])
    monkeypatch.setattr(imwm, "run_sql_async", mock_run)
    
    await imwm.fetch_imwm_aging("token")
    assert "imwm_analytics_aging_v" in mock_run.call_args[0][1]
