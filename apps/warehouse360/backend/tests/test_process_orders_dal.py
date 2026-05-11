import pytest
from unittest.mock import AsyncMock, patch
from warehouse360_backend.order_fulfillment.dal import process_orders


@pytest.mark.asyncio
async def test_fetch_process_orders(monkeypatch):
    mock_run = AsyncMock(return_value=[])
    monkeypatch.setattr(process_orders, "run_sql_async", mock_run)
    
    await process_orders.fetch_process_orders("token")
    assert "wh360_process_orders_v" in mock_run.call_args[0][1]


@pytest.mark.asyncio
async def test_fetch_order_detail_with_reservation(monkeypatch):
    async def mock_run(_token, query, _params=None, **kwargs):
        if "wh360_process_orders_v" in query:
            return [{"order_id": "1001", "reservation_no": "R1"}]
        return []
        
    monkeypatch.setattr(process_orders, "run_sql_async", mock_run)
    
    result = await process_orders.fetch_order_detail("token", "1001")
    assert result["order"]["order_id"] == "1001"
    assert result["transfer_requirements"] == []


@pytest.mark.asyncio
async def test_fetch_order_detail_no_reservation(monkeypatch):
    async def mock_run(_token, query, _params=None, **kwargs):
        if "wh360_process_orders_v" in query:
            return [{"order_id": "1001", "reservation_no": None}]
        return []
        
    monkeypatch.setattr(process_orders, "run_sql_async", mock_run)
    
    result = await process_orders.fetch_order_detail("token", "1001")
    assert result["order"]["reservation_no"] is None
    assert result["transfer_requirements"] == []
