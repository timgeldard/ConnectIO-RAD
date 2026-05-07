from fastapi.testclient import TestClient
import warehouse360_backend.main as main_module
from warehouse360_backend.main import app

client = TestClient(app)

def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_ready(monkeypatch):
    """Verify /api/ready returns status 'ready' with detailed checks when all dependencies are healthy."""
    monkeypatch.setenv("DATABRICKS_READINESS_TOKEN", "token")
    monkeypatch.setattr(main_module, "check_warehouse_config", lambda: None)

    async def run_sql(token, query, endpoint_hint=None):
        return [{"ok": 1}]

    monkeypatch.setattr(main_module, "run_sql_async", run_sql)

    response = client.get("/api/ready")
    assert response.status_code == 200
    assert response.json() == {
        "status": "ready",
        "checks": {"config": "ok", "sql_warehouse": "ok"},
    }
