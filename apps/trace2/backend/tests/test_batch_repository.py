import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from shared_trace.domain.models import BatchIdentity
from trace2_backend.batch_trace.dal.batch_repository import BatchRepository


@pytest.mark.asyncio
async def test_batch_repository_get_success():
    mock_dal = AsyncMock()
    mock_dal.fetch_batch_header.return_value = {
        "material_id": "M1",
        "batch_id": "B1",
        "plant_id": "P1",
        "batch_status": "Released",
        "manufacture_date": "2024-01-01T00:00:00",
        "expiry_date": "2025-01-01T00:00:00",
    }
    
    with patch("trace2_backend.batch_trace.dal.batch_repository.get_trace_core_dal", return_value=mock_dal):
        repo = BatchRepository("token")
        identity = BatchIdentity("M1", "B1")
        batch = await repo.get(identity)
        
        assert batch is not None
        assert batch.identity == identity
        assert batch.plant_id == "P1"
        assert batch.release_status == "Released"
        assert batch.created_date.year == 2024


@pytest.mark.asyncio
async def test_batch_repository_get_not_found():
    mock_dal = AsyncMock()
    mock_dal.fetch_batch_header.return_value = None
    
    with patch("trace2_backend.batch_trace.dal.batch_repository.get_trace_core_dal", return_value=mock_dal):
        repo = BatchRepository("token")
        batch = await repo.get(BatchIdentity("M1", "B1"))
        assert batch is None


@pytest.mark.asyncio
async def test_batch_repository_save_raises():
    repo = BatchRepository("token")
    with pytest.raises(NotImplementedError):
        await repo.save(MagicMock())
