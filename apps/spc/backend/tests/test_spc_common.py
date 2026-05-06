import pytest
from fastapi import HTTPException
import numpy as np
from spc_backend.utils.db import handle_sql_error, handle_analysis_error, handle_locked_limits_error, attach_payload_freshness
from unittest.mock import AsyncMock

def test_handle_sql_error():
    with pytest.raises(HTTPException) as exc:
        handle_sql_error(Exception("unknown error"))
    assert exc.value.status_code == 500
    assert "reference id" in exc.value.detail

def test_handle_analysis_error():
    # ValueError -> 422
    with pytest.raises(HTTPException) as exc:
        handle_analysis_error(ValueError("user error"))
    assert exc.value.status_code == 422
    assert exc.value.detail == "user error"
    
    # LinAlgError -> 422
    with pytest.raises(HTTPException) as exc:
        handle_analysis_error(np.linalg.LinAlgError("singular"))
    assert exc.value.status_code == 422
    assert "degenerate covariance matrix" in exc.value.detail

def test_handle_locked_limits_error():
    # Missing table -> 503
    with pytest.raises(HTTPException) as exc:
        handle_locked_limits_error(Exception("Table or view not found: spc_locked_limits"))
    assert exc.value.status_code == 503
    assert "not initialised" in exc.value.detail

@pytest.mark.asyncio
async def test_attach_payload_freshness_error_handling():
    # Mock attacher that fails with 503
    mock_attacher = AsyncMock(side_effect=HTTPException(status_code=503, detail={"message": "Data freshness lookup failed"}))
    
    res = await attach_payload_freshness(
        payload={"data": 1},
        token="token",
        request_path="/path",
        source_views=["view"],
        attach_freshness_func=mock_attacher
    )
    
    assert res["data_freshness"] is None
    assert res["data_freshness_warning"]["message"] == "Data freshness lookup failed"
