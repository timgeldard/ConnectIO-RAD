import pytest
from unittest.mock import AsyncMock
from shared_manufacturing import test_data
from envmon_backend.inspection_analysis.dal import lots


@pytest.mark.asyncio
async def test_fetch_lots(monkeypatch):
    mock_run = AsyncMock(return_value=[])
    monkeypatch.setattr(lots, "run_sql_async", mock_run)
    
    await lots.fetch_lots("token", "P1", "L1", "2024-01-01")
    assert mock_run.called
    assert "INSPECTION_LOT_ID" in mock_run.call_args[0][1]


@pytest.mark.asyncio
async def test_fetch_lot_detail(monkeypatch):
    mock_run = AsyncMock(return_value=[])
    monkeypatch.setattr(lots, "run_sql_async", mock_run)
    
    await lots.fetch_lot_detail("token", "LOT1", "P1")
    assert mock_run.called
    assert "MIC_ID" in mock_run.call_args[0][1]


@pytest.mark.asyncio
async def test_fetch_location_mics(monkeypatch):
    mock_run = AsyncMock(return_value=[])
    monkeypatch.setattr(lots, "run_sql_async", mock_run)
    
    await lots.fetch_location_mics("token", "P1", "L1", "2024-01-01")
    assert "DISTINCT UPPER(TRIM(r.MIC_NAME))" in mock_run.call_args[0][1]


@pytest.mark.asyncio
async def test_fetch_location_recent_lots(monkeypatch):
    mock_run = AsyncMock(return_value=[])
    monkeypatch.setattr(lots, "run_sql_async", mock_run)
    
    await lots.fetch_location_recent_lots("token", "P1", "L1", "2024-01-01")
    assert "LIMIT 5" in mock_run.call_args[0][1]
