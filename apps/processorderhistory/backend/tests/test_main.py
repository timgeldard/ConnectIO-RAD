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
    """`/api/ready` returns 200 when warehouse config and SQL connectivity are available.

    After the ConnectIoApp migration the readiness probe also guards on
    ``DATABRICKS_READINESS_TOKEN`` (returning 503 when absent), so the
    test sets it explicitly to exercise the success path.
    """
    monkeypatch.setenv("DATABRICKS_READINESS_TOKEN", "fake-token")
    ready_payload = {"status": "ready", "checks": {"config": "ok", "sql_warehouse": "ok"}}

    async def _mock_ready(**_kwargs):
        return ready_payload

    monkeypatch.setattr("processorderhistory_backend.main.databricks_sql_ready", _mock_ready)
    response = client.get("/api/ready")
    assert response.status_code == 200
    assert response.json() == ready_payload
