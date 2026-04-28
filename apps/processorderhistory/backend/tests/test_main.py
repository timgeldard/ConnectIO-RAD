"""Smoke tests for the Process Order History FastAPI shell."""

from fastapi.testclient import TestClient
import backend.main as main_module

from backend.main import app

client = TestClient(app)


def test_health() -> None:
    """`/api/health` returns the shared liveness payload with status `ok`."""
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_ready(monkeypatch) -> None:
    """`/api/ready` returns 200 when warehouse config is present."""
    monkeypatch.setattr("backend.main.check_warehouse_config", lambda: None)
    response = client.get("/api/ready")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
