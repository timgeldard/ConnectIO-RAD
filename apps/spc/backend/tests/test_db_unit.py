import pytest
import os
from unittest.mock import MagicMock, AsyncMock, patch
from spc_backend.utils import db as db_module

def test_warehouse_id_parsing():
    with patch("spc_backend.utils.db.WAREHOUSE_HTTP_PATH", "/sql/1.0/warehouses/abc123"):
        assert db_module._warehouse_id() == "abc123"

def test_first_param_value_extraction():
    params = [
        {"name": "mat_id", "value": "M1"},
        {"name": "plant", "value": "P1"},
    ]
    assert db_module._first_param_value(params, "mat_id") == "M1"
    assert db_module._first_param_value(params, "nonexistent", "plant") == "P1"
    assert db_module._first_param_value(params, "missing") is None

def test_configured_sql_executor_selection(monkeypatch):
    monkeypatch.setenv("SPC_SQL_EXECUTOR", "CONNECTOR")
    assert db_module._configured_sql_executor_name() == "connector"
    
    monkeypatch.setenv("SPC_SQL_EXECUTOR", "invalid")
    assert db_module._configured_sql_executor_name() == "rest"

def test_get_sql_executor_fallback(monkeypatch):
    monkeypatch.setenv("SPC_SQL_EXECUTOR", "connector")
    # Simulate databricks-sql not being installed
    with patch("spc_backend.utils.db.databricks_sql", None):
        executor = db_module._get_sql_executor()
        from shared_db.executors import _REST_EXECUTOR
        assert executor == _REST_EXECUTOR

@pytest.mark.asyncio
async def test_spc_query_audit_hook_suppression():
    # Hook should return early for audit statements
    with patch("spc_backend.utils.db.insert_spc_query_audit") as mock_insert:
        await db_module._spc_query_audit_hook(
            token="t", statement="INSERT INTO spc_query_audit",
            params=[], endpoint_hint="hint"
        )
        mock_insert.assert_not_called()

@pytest.mark.asyncio
async def test_attach_data_freshness_error_handling(monkeypatch):
    payload = {}
    
    async def mock_insert_audit(*args, **kwargs):
        pass
        
    monkeypatch.setattr(db_module, "insert_spc_audit_event", mock_insert_audit)
    
    with patch("spc_backend.utils.db.get_data_freshness", side_effect=RuntimeError("connection failed")):
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            await db_module.attach_data_freshness(payload, "token", ["view1"])
        assert exc.value.status_code == 503
