import pytest
from unittest.mock import AsyncMock, patch
from shared_domain import test_data
from warehouse360_backend.inventory_management.dal import inventory


@pytest.mark.asyncio
async def test_fetch_bin_stock_no_plant_no_type(monkeypatch):
    mock_run = AsyncMock(return_value=[])
    monkeypatch.setattr(inventory, "run_sql_async", mock_run)
    
    await inventory.fetch_bin_stock("token")
    sql = mock_run.call_args[0][1]
    assert "WHERE" not in sql


@pytest.mark.asyncio
async def test_fetch_bin_stock_with_lgtyp_only(monkeypatch):
    mock_run = AsyncMock(return_value=[])
    monkeypatch.setattr(inventory, "run_sql_async", mock_run)
    
    await inventory.fetch_bin_stock("token", lgtyp="100")
    sql = mock_run.call_args[0][1]
    assert "WHERE lgtyp = :lgtyp" in sql
    assert mock_run.call_args[0][2][0]["value"] == "100"


@pytest.mark.asyncio
async def test_fetch_bin_stock_with_plant_and_lgtyp(monkeypatch):
    mock_run = AsyncMock(return_value=[])
    monkeypatch.setattr(inventory, "run_sql_async", mock_run)
    plant = test_data.PLANTS[0]
    
    await inventory.fetch_bin_stock("token", plant_id=plant, lgtyp="200")
    sql = mock_run.call_args[0][1]
    assert "WHERE plant_id = :plant_id" in sql
    assert "AND lgtyp = :lgtyp" in sql
    params = mock_run.call_args[0][2]
    assert any(p["name"] == "plant_id" and p["value"] == plant for p in params)
    assert any(p["name"] == "lgtyp" and p["value"] == "200" for p in params)


@pytest.mark.asyncio
async def test_fetch_bin_stock_summary(monkeypatch):
    mock_run = AsyncMock(return_value=[])
    monkeypatch.setattr(inventory, "run_sql_async", mock_run)
    
    await inventory.fetch_bin_stock_summary("token")
    assert "total_bins" in mock_run.call_args[0][1]


@pytest.mark.asyncio
async def test_fetch_lineside(monkeypatch):
    mock_run = AsyncMock(return_value=[])
    monkeypatch.setattr(inventory, "run_sql_async", mock_run)
    
    await inventory.fetch_lineside("token")
    assert "wh360_lineside_stock_v" in mock_run.call_args[0][1]


@pytest.mark.asyncio
async def test_fetch_near_expiry_batches(monkeypatch):
    mock_run = AsyncMock(return_value=[])
    monkeypatch.setattr(inventory, "run_sql_async", mock_run)
    
    await inventory.fetch_near_expiry_batches("token")
    assert "wh360_near_expiry_batches_v" in mock_run.call_args[0][1]
