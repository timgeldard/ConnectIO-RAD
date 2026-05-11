import pytest
from unittest.mock import AsyncMock
from envmon_backend.inspection_analysis.dal import trends


@pytest.mark.asyncio
async def test_fetch_mics_global(monkeypatch):
    mock_run = AsyncMock(return_value=[])
    monkeypatch.setattr(trends, "run_sql_async", mock_run)
    
    await trends.fetch_mics("token", "P1", None, "2024-01-01")
    assert "lot.CREATED_DATE >= :date_from" in mock_run.call_args[0][1]


@pytest.mark.asyncio
async def test_fetch_mics_location(monkeypatch):
    mock_run = AsyncMock(return_value=[])
    monkeypatch.setattr(trends, "run_sql_async", mock_run)
    
    await trends.fetch_mics("token", "P1", "LOC1", "2024-01-01")
    assert "ip.FUNCTIONAL_LOCATION = :func_loc_id" in mock_run.call_args[0][1]


@pytest.mark.asyncio
async def test_fetch_trends(monkeypatch):
    mock_run = AsyncMock(return_value=[])
    monkeypatch.setattr(trends, "run_sql_async", mock_run)
    
    await trends.fetch_trends("token", "P1", "L1", "MIC1", "2024-01-01")
    assert "ORDER BY lot.CREATED_DATE ASC" in mock_run.call_args[0][1]
