import pytest
from unittest.mock import AsyncMock
from trace2_backend.dal import trace_dal


@pytest.mark.asyncio
async def test_fetch_trace_tree_wrapper(monkeypatch):
    mock = AsyncMock(return_value=[])
    monkeypatch.setattr(trace_dal, "_fetch_trace_tree", mock)
    await trace_dal.fetch_trace_tree("t", "M", "B")
    assert mock.called


@pytest.mark.asyncio
async def test_fetch_summary_wrapper(monkeypatch):
    mock = AsyncMock(return_value={})
    monkeypatch.setattr(trace_dal, "_fetch_summary", mock)
    await trace_dal.fetch_summary("t", "B")
    assert mock.called


@pytest.mark.asyncio
async def test_fetch_batch_details_wrapper(monkeypatch):
    mock = AsyncMock(return_value={})
    monkeypatch.setattr(trace_dal, "_fetch_batch_details", mock)
    await trace_dal.fetch_batch_details("t", "M", "B")
    assert mock.called


@pytest.mark.asyncio
async def test_fetch_impact_wrapper(monkeypatch):
    mock = AsyncMock(return_value={})
    monkeypatch.setattr(trace_dal, "_fetch_impact", mock)
    await trace_dal.fetch_impact("t", "B")
    assert mock.called


@pytest.mark.asyncio
async def test_fetch_recall_readiness_wrapper(monkeypatch):
    mock = AsyncMock(return_value={})
    monkeypatch.setattr(trace_dal, "_fetch_recall_readiness", mock)
    await trace_dal.fetch_recall_readiness("t", "M", "B")
    assert mock.called


@pytest.mark.asyncio
async def test_fetch_batch_header_wrapper(monkeypatch):
    mock = AsyncMock(return_value={})
    monkeypatch.setattr(trace_dal, "_fetch_batch_header", mock)
    await trace_dal.fetch_batch_header("t", "M", "B")
    assert mock.called


@pytest.mark.asyncio
async def test_fetch_coa_wrapper(monkeypatch):
    mock = AsyncMock(return_value={})
    monkeypatch.setattr(trace_dal, "_fetch_coa", mock)
    await trace_dal.fetch_coa("t", "M", "B")
    assert mock.called


@pytest.mark.asyncio
async def test_fetch_mass_balance_wrapper(monkeypatch):
    mock = AsyncMock(return_value={})
    monkeypatch.setattr(trace_dal, "_fetch_mass_balance", mock)
    await trace_dal.fetch_mass_balance("t", "M", "B")
    assert mock.called


@pytest.mark.asyncio
async def test_fetch_quality_wrapper(monkeypatch):
    mock = AsyncMock(return_value={})
    monkeypatch.setattr(trace_dal, "_fetch_quality", mock)
    await trace_dal.fetch_quality("t", "M", "B")
    assert mock.called


@pytest.mark.asyncio
async def test_fetch_production_history_wrapper(monkeypatch):
    mock = AsyncMock(return_value={})
    monkeypatch.setattr(trace_dal, "_fetch_production_history", mock)
    await trace_dal.fetch_production_history("t", "M", "B")
    assert mock.called


@pytest.mark.asyncio
async def test_fetch_batch_compare_wrapper(monkeypatch):
    mock = AsyncMock(return_value={})
    monkeypatch.setattr(trace_dal, "_fetch_batch_compare", mock)
    await trace_dal.fetch_batch_compare("t", "M", "B")
    assert mock.called


@pytest.mark.asyncio
async def test_fetch_bottom_up_wrapper(monkeypatch):
    mock = AsyncMock(return_value={})
    monkeypatch.setattr(trace_dal, "_fetch_bottom_up", mock)
    await trace_dal.fetch_bottom_up("t", "M", "B")
    assert mock.called


@pytest.mark.asyncio
async def test_fetch_top_down_wrapper(monkeypatch):
    mock = AsyncMock(return_value={})
    monkeypatch.setattr(trace_dal, "_fetch_top_down", mock)
    await trace_dal.fetch_top_down("t", "M", "B")
    assert mock.called


@pytest.mark.asyncio
async def test_fetch_supplier_risk_wrapper(monkeypatch):
    mock = AsyncMock(return_value={})
    monkeypatch.setattr(trace_dal, "_fetch_supplier_risk", mock)
    await trace_dal.fetch_supplier_risk("t", "M", "B")
    assert mock.called
