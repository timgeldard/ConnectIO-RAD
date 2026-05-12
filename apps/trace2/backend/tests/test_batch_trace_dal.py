import pytest
from unittest.mock import AsyncMock
from shared_trace.domain.models import BatchIdentity, BatchOnlyIdentity
from trace2_backend.batch_trace.dal import trace


@pytest.mark.asyncio
async def test_fetch_trace_tree(monkeypatch):
    mock_dal = AsyncMock()
    mock_dal.fetch_trace_tree.return_value = [{"id": 1}]
    monkeypatch.setattr(trace, "_dal", mock_dal)
    
    res = await trace.fetch_trace_tree("token", BatchIdentity("M", "B"))
    assert res == [{"id": 1}]
    assert mock_dal.fetch_trace_tree.called


@pytest.mark.asyncio
async def test_fetch_summary(monkeypatch):
    mock_dal = AsyncMock()
    mock_dal.fetch_summary.return_value = {"ok": True}
    monkeypatch.setattr(trace, "_dal", mock_dal)
    
    res = await trace.fetch_summary("token", BatchOnlyIdentity("B"))
    assert res == {"ok": True}


@pytest.mark.asyncio
async def test_fetch_batch_details(monkeypatch):
    mock_dal = AsyncMock()
    monkeypatch.setattr(trace, "_dal", mock_dal)
    await trace.fetch_batch_details("token", BatchIdentity("M", "B"))
    assert mock_dal.fetch_batch_details.called


@pytest.mark.asyncio
async def test_fetch_impact(monkeypatch):
    mock_dal = AsyncMock()
    monkeypatch.setattr(trace, "_dal", mock_dal)
    await trace.fetch_impact("token", BatchOnlyIdentity("B"))
    assert mock_dal.fetch_impact.called
