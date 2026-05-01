import pytest
from fastapi import HTTPException
from unittest.mock import AsyncMock
from shared_db import utils as spc_common

@pytest.mark.asyncio
async def test_attach_validation_freshness_success():
    payload = {"data": 123}
    expected = {**payload, "data_freshness": {"ready": True}}
    
    mock_attacher = AsyncMock(return_value=expected)
    
    res = await spc_common.attach_validation_freshness(
        payload, 
        "token", 
        "/path", 
        attach_freshness_func=mock_attacher
    )
    assert res == expected

@pytest.mark.asyncio
async def test_attach_validation_freshness_503_fallback():
    mock_attacher = AsyncMock(side_effect=HTTPException(status_code=503, detail={"message": "Data freshness lookup failed"}))
    
    res = await spc_common.attach_validation_freshness(
        {"data": 1}, 
        "token", 
        "/path", 
        attach_freshness_func=mock_attacher
    )
    assert res["data_freshness"] is None
    assert "data_freshness_warning" in res

def test_handle_sql_error_mapped():
    # 403 case
    with pytest.raises(HTTPException) as exc:
        spc_common.handle_sql_error(Exception("Permission denied"))
    assert exc.value.status_code == 403

def test_handle_sql_error_unmapped():
    with pytest.raises(HTTPException) as exc:
        spc_common.handle_sql_error(Exception("Something weird"))
    assert exc.value.status_code == 500
