import pytest
from unittest.mock import AsyncMock, patch
from warehouse360_backend.order_fulfillment.dal import deliveries


@pytest.mark.asyncio
async def test_fetch_deliveries(monkeypatch):
    mock_run = AsyncMock(return_value=[])
    monkeypatch.setattr(deliveries, "run_sql_async", mock_run)
    
    await deliveries.fetch_deliveries("token")
    assert "wh360_deliveries_v" in mock_run.call_args[0][1]


@pytest.mark.asyncio
async def test_fetch_delivery_detail(monkeypatch):
    # gather calls 3 SQL queries
    mock_run = AsyncMock(return_value=[])
    monkeypatch.setattr(deliveries, "run_sql_async", mock_run)
    
    result = await deliveries.fetch_delivery_detail("token", "D1")
    assert result["delivery"] is None
    assert result["transfer_orders"] == []
    assert mock_run.call_count == 3
