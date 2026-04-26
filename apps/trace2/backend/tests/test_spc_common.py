import pytest
from fastapi import HTTPException
from unittest.mock import AsyncMock, patch
import backend.routers.spc_common as spc_common

@pytest.mark.asyncio
async def test_attach_validation_freshness_success():
    payload = {"data": 123}
    expected = {**payload, "data_freshness": {"ready": True}}
    
    with patch("backend.routers.spc_common.attach_data_freshness", new_callable=AsyncMock) as mock_fresh:
        mock_fresh.return_value = expected
        result = await spc_common.attach_validation_freshness(payload, "token", "/path")
        assert result == expected

@pytest.mark.asyncio
async def test_attach_validation_freshness_503_fallback():
    payload = {"data": 123}
    detail = {"message": "Data freshness lookup failed", "error_id": "123"}
    
    with patch("backend.routers.spc_common.attach_data_freshness", side_effect=HTTPException(status_code=503, detail=detail)):
        result = await spc_common.attach_validation_freshness(payload, "token", "/path")
        assert result["data"] == 123
        assert result["data_freshness"] is None
        assert result["data_freshness_warning"] == detail

def test_handle_sql_error_mapped():
    with patch("backend.routers.spc_common.classify_sql_runtime_error", return_value=HTTPException(status_code=400, detail="Mapped")):
        with pytest.raises(HTTPException) as exc:
            spc_common.handle_sql_error(Exception("Raw"))
        assert exc.value.status_code == 400

def test_handle_sql_error_unmapped():
    with patch("backend.routers.spc_common.classify_sql_runtime_error", return_value=None):
        with pytest.raises(HTTPException) as exc:
            spc_common.handle_sql_error(Exception("Raw"))
        assert exc.value.status_code == 500
        assert "Internal server error" in str(exc.value.detail)

def test_handle_locked_limits_error():
    with pytest.raises(HTTPException) as exc:
        spc_common.handle_locked_limits_error(Exception("table or view not found"))
    assert exc.value.status_code == 503
    assert "Locked limits table not initialised" in exc.value.detail
