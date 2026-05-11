import pytest
from unittest.mock import AsyncMock
from shared_domain import test_data
from warehouse360_backend.inventory_management.dal import inbound


@pytest.mark.asyncio
async def test_fetch_inbound_no_plant(monkeypatch):
    mock_run = AsyncMock(return_value=[])
    monkeypatch.setattr(inbound, "run_sql_async", mock_run)
    
    await inbound.fetch_inbound("token")
    assert "wh360_inbound_v" in mock_run.call_args[0][1]


@pytest.mark.asyncio
async def test_fetch_receipt_detail(monkeypatch):
    mock_run = AsyncMock(return_value=[{"po_id": "4501", "po_item": "10"}])
    monkeypatch.setattr(inbound, "run_sql_async", mock_run)
    
    res = await inbound.fetch_receipt_detail("token", "4501")
    assert res["receipt"]["po_id"] == "4501"
    assert len(res["items"]) == 1
