import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock
from trace2_backend.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def mock_auth(monkeypatch):
    from shared_auth import require_proxy_user, UserIdentity
    app.dependency_overrides[require_proxy_user] = lambda: UserIdentity(user_id="test", raw_token="token")
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def mock_dals(monkeypatch):
    from trace2_backend.batch_trace import router as batch_router
    from trace2_backend.lineage_analysis import router as lineage_router
    from trace2_backend.quality_record import router as quality_router
    
    # Correct names from router.py files
    monkeypatch.setattr(batch_router, "get_trace_tree", AsyncMock(return_value={"nodes": []}))
    monkeypatch.setattr(batch_router, "get_summary", AsyncMock(return_value={}))
    monkeypatch.setattr(batch_router, "get_batch_details", AsyncMock(return_value={}))
    monkeypatch.setattr(batch_router, "get_impact", AsyncMock(return_value={}))
    monkeypatch.setattr(batch_router, "get_batch_header", AsyncMock(return_value={}))
    
    monkeypatch.setattr(lineage_router, "get_recall_readiness", AsyncMock(return_value={}))
    monkeypatch.setattr(lineage_router, "get_bottom_up", AsyncMock(return_value={}))
    monkeypatch.setattr(lineage_router, "get_top_down", AsyncMock(return_value={}))
    monkeypatch.setattr(lineage_router, "get_supplier_risk", AsyncMock(return_value={}))
    
    monkeypatch.setattr(quality_router, "get_coa", AsyncMock(return_value={}))
    monkeypatch.setattr(quality_router, "get_mass_balance", AsyncMock(return_value={}))
    monkeypatch.setattr(quality_router, "get_quality", AsyncMock(return_value={}))
    monkeypatch.setattr(quality_router, "get_production_history", AsyncMock(return_value={}))
    monkeypatch.setattr(quality_router, "get_batch_compare", AsyncMock(return_value={}))
    
    # Mock config
    for mod in [batch_router, lineage_router, quality_router]:
        monkeypatch.setattr(mod, "check_warehouse_config", lambda: None)


def test_batch_trace_router_smoke(mock_dals):
    assert client.post("/api/trace", json={"material_id": "M1", "batch_id": "B1"}).status_code == 200
    assert client.post("/api/summary", json={"batch_id": "B1"}).status_code == 200
    assert client.post("/api/batch-details", json={"material_id": "M1", "batch_id": "B1"}).status_code == 200
    assert client.post("/api/impact", json={"batch_id": "B1"}).status_code == 200


def test_lineage_router_smoke(mock_dals):
    assert client.post("/api/recall-readiness", json={"material_id": "M1", "batch_id": "B1"}).status_code == 200
    assert client.post("/api/bottom-up", json={"material_id": "M1", "batch_id": "B1"}).status_code == 200
    assert client.post("/api/top-down", json={"material_id": "M1", "batch_id": "B1"}).status_code == 200
    assert client.post("/api/supplier-risk", json={"material_id": "M1", "batch_id": "B1"}).status_code == 200


def test_quality_router_smoke(mock_dals):
    assert client.post("/api/coa", json={"material_id": "M1", "batch_id": "B1"}).status_code == 200
    assert client.post("/api/mass-balance", json={"material_id": "M1", "batch_id": "B1"}).status_code == 200
    assert client.post("/api/quality", json={"material_id": "M1", "batch_id": "B1"}).status_code == 200
    assert client.post("/api/production-history", json={"material_id": "M1", "batch_id": "B1"}).status_code == 200
    assert client.post("/api/batch-compare", json={"material_id": "M1", "batch_id": "B1"}).status_code == 200
