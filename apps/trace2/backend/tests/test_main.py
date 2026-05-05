from fastapi import HTTPException
from fastapi.testclient import TestClient

from trace2_backend.main import app
import trace2_backend.main as main_module


client = TestClient(app)


def test_health_returns_200():
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_ready_returns_503_when_readiness_token_missing(monkeypatch):
    monkeypatch.setattr(main_module, "check_warehouse_config", lambda: "/sql/1.0/warehouses/test")
    monkeypatch.delenv("DATABRICKS_READINESS_TOKEN", raising=False)

    response = client.get("/api/ready")

    assert response.status_code == 503
    assert response.json()["detail"]["reason"] == "readiness_token_missing"


def test_ready_returns_503_when_warehouse_config_missing(monkeypatch):
    monkeypatch.setenv("DATABRICKS_READINESS_TOKEN", "fake-token")
    def missing_config():
        raise HTTPException(status_code=500, detail="missing warehouse")

    monkeypatch.setattr(main_module, "check_warehouse_config", missing_config)

    response = client.get("/api/ready")

    assert response.status_code == 503
    assert response.json()["detail"]["reason"] == "warehouse_config_missing"


def test_health_debug_hidden_outside_development(monkeypatch):
    monkeypatch.setattr(main_module, "ENABLE_DEBUG_ENDPOINTS", False)

    response = client.get("/api/health/debug")

    assert response.status_code == 404


def test_cross_origin_mutation_blocked_before_route_handler():
    response = client.post(
        "/api/trace",
        headers={"Origin": "https://evil.example.com"},
        json={"material_id": "MAT1", "batch_id": "BATCH1"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Cross-origin mutation blocked"
