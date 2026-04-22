from fastapi import HTTPException
from fastapi.testclient import TestClient

from backend.main import app
import backend.main as main_module


client = TestClient(app)


def test_health_returns_200():
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_ready_returns_503_when_warehouse_config_missing(monkeypatch):
    def missing_config():
        raise HTTPException(status_code=500, detail="missing warehouse")

    monkeypatch.setattr(main_module, "check_warehouse_config", missing_config)

    response = client.get("/api/ready")

    assert response.status_code == 503
    assert response.json()["detail"]["reason"] == "warehouse_config_missing"


def test_spa_fallback_reports_frontend_not_built(monkeypatch, tmp_path):
    monkeypatch.setattr(main_module, "STATIC_DIR", tmp_path / "missing-dist")

    response = client.get("/")

    assert response.status_code == 200
    assert response.json() == {"status": "backend running", "frontend": "not built"}


def test_cross_origin_mutation_blocked_before_route_handler():
    response = client.post(
        "/api/em/coordinates",
        headers={"Origin": "https://evil.example.com"},
        json={"func_loc_id": "L1", "floor_id": "F1", "x_pos": 10, "y_pos": 20},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Cross-origin mutation blocked"
