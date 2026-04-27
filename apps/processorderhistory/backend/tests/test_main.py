"""Smoke tests for the Process Order History FastAPI shell."""

from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def test_health() -> None:
    """`/api/health` returns the shared liveness payload with status `ok`."""
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_ready() -> None:
    """`/api/ready` returns 200 unconditionally until SQL routers exist."""
    response = client.get("/api/ready")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
