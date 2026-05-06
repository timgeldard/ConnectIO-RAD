"""Smoke tests for the Process Order History FastAPI shell."""

from fastapi.testclient import TestClient

from processorderhistory_backend.main import app

client = TestClient(app)


def test_health() -> None:
    """`/api/health` returns the shared liveness payload with status `ok`."""
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_ready(monkeypatch) -> None:
    """`/api/ready` returns 200 when warehouse config and SQL connectivity are available."""
    ready_payload = {"status": "ready", "checks": {"config": "ok", "sql_warehouse": "ok"}}

    async def _mock_ready(**_kwargs):
        return ready_payload

    monkeypatch.setattr("processorderhistory_backend.main.databricks_sql_ready", _mock_ready)
    response = client.get("/api/ready")
    assert response.status_code == 200
    assert response.json() == ready_payload
