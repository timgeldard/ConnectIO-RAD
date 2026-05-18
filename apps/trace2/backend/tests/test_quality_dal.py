"""Unit tests for the trace2 quality record DAL context."""

from unittest.mock import AsyncMock
import pytest
from shared_trace.domain.models import BatchIdentity
from trace2_backend.quality_record.dal import quality


@pytest.mark.asyncio
async def test_fetch_coa(monkeypatch):
    """Test fetch_coa calls the underlying dal method."""
    mock_dal = AsyncMock()
    mock_dal.fetch_coa.return_value = {"ok": True}
    monkeypatch.setattr(quality, "_dal", mock_dal)

    res = await quality.fetch_coa("token", BatchIdentity("M", "B"))
    assert res == {"ok": True}
    mock_dal.fetch_coa.assert_called_once_with("token", "M", "B")


@pytest.mark.asyncio
async def test_fetch_mass_balance(monkeypatch):
    """Test fetch_mass_balance calls the underlying dal method."""
    mock_dal = AsyncMock()
    mock_dal.fetch_mass_balance.return_value = {"ok": True}
    monkeypatch.setattr(quality, "_dal", mock_dal)

    res = await quality.fetch_mass_balance("token", BatchIdentity("M", "B"))
    assert res == {"ok": True}
    mock_dal.fetch_mass_balance.assert_called_once_with("token", "M", "B")


@pytest.mark.asyncio
async def test_fetch_quality(monkeypatch):
    """Test fetch_quality calls the underlying dal method."""
    mock_dal = AsyncMock()
    mock_dal.fetch_quality.return_value = {"ok": True}
    monkeypatch.setattr(quality, "_dal", mock_dal)

    res = await quality.fetch_quality("token", BatchIdentity("M", "B"))
    assert res == {"ok": True}
    mock_dal.fetch_quality.assert_called_once_with("token", "M", "B")


@pytest.mark.asyncio
async def test_fetch_production_history(monkeypatch):
    """Test fetch_production_history calls the underlying dal method."""
    mock_dal = AsyncMock()
    mock_dal.fetch_production_history.return_value = {"ok": True}
    monkeypatch.setattr(quality, "_dal", mock_dal)

    res = await quality.fetch_production_history("token", BatchIdentity("M", "B"), limit=10)
    assert res == {"ok": True}
    mock_dal.fetch_production_history.assert_called_once_with("token", "M", "B", 10)


@pytest.mark.asyncio
async def test_fetch_batch_compare(monkeypatch):
    """Test fetch_batch_compare calls the underlying dal method."""
    mock_dal = AsyncMock()
    mock_dal.fetch_batch_compare.return_value = {"ok": True}
    monkeypatch.setattr(quality, "_dal", mock_dal)

    res = await quality.fetch_batch_compare("token", BatchIdentity("M", "B"), limit=5)
    assert res == {"ok": True}
    mock_dal.fetch_batch_compare.assert_called_once_with("token", "M", "B", 5)
