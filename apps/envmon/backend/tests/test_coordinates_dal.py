import pytest
from unittest.mock import AsyncMock
from envmon_backend.spatial_config.dal import coordinates


@pytest.mark.asyncio
async def test_fetch_unmapped_locations(monkeypatch):
    mock_run = AsyncMock(return_value=[])
    monkeypatch.setattr(coordinates, "run_sql_async", mock_run)
    
    await coordinates.fetch_unmapped_locations("token", "P1")
    assert "LEFT JOIN" in mock_run.call_args[0][1]
    assert "c.func_loc_id IS NULL" in mock_run.call_args[0][1]


@pytest.mark.asyncio
async def test_fetch_mapped_locations(monkeypatch):
    mock_run = AsyncMock(return_value=[])
    monkeypatch.setattr(coordinates, "run_sql_async", mock_run)
    
    await coordinates.fetch_mapped_locations("token", "P1")
    assert "ORDER BY floor_id, func_loc_id" in mock_run.call_args[0][1]


@pytest.mark.asyncio
async def test_fetch_location_coordinate(monkeypatch):
    mock_run = AsyncMock(return_value=[])
    monkeypatch.setattr(coordinates, "run_sql_async", mock_run)
    
    await coordinates.fetch_location_coordinate("token", "P1", "L1")
    assert "WHERE func_loc_id = :func_loc_id" in mock_run.call_args[0][1]


@pytest.mark.asyncio
async def test_fetch_locations(monkeypatch):
    mock_run = AsyncMock(return_value=[])
    monkeypatch.setattr(coordinates, "run_sql_async", mock_run)
    
    await coordinates.fetch_locations("token", "P1", floor_id="F1", mapped_only=True)
    assert "AND c.floor_id = :floor_id" in mock_run.call_args[0][1]
    assert "WHERE c.func_loc_id IS NOT NULL" in mock_run.call_args[0][1]


@pytest.mark.asyncio
async def test_upsert_coordinate(monkeypatch):
    mock_run = AsyncMock(return_value=[])
    monkeypatch.setattr(coordinates, "run_sql_async", mock_run)
    
    await coordinates.upsert_coordinate("token", "P1", "L1", "F1", 10.0, 20.0)
    assert "MERGE INTO" in mock_run.call_args[0][1]


@pytest.mark.asyncio
async def test_delete_coordinate(monkeypatch):
    mock_run = AsyncMock(return_value=[])
    monkeypatch.setattr(coordinates, "run_sql_async", mock_run)
    
    await coordinates.delete_coordinate("token", "P1", "L1")
    assert "DELETE FROM" in mock_run.call_args[0][1]
