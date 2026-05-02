"""Smoke tests for ConnectedQuality backend API."""

from fastapi.testclient import TestClient

from backend.main import app
import backend.main as main_module

client = TestClient(app)


def test_health_returns_200():
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_spa_fallback_reports_frontend_not_built(monkeypatch, tmp_path):
    monkeypatch.setattr(main_module, "STATIC_DIR", tmp_path / "missing-dist")

    response = client.get("/")

    assert response.status_code == 200
    assert response.json() == {"status": "backend running", "frontend": "not built"}


def test_cross_origin_mutation_blocked():
    response = client.post(
        "/api/cq/trace/recall",
        headers={"Origin": "https://evil.example.com"},
        json={},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Cross-origin mutation blocked"


def test_trace_recall_returns_batch():
    response = client.get("/api/cq/trace/recall")

    assert response.status_code == 200
    data = response.json()
    assert "batch" in data
    assert "customers_affected" in data


def test_envmon_plants_returns_list():
    response = client.get("/api/cq/envmon/plants")

    assert response.status_code == 200
    assert "plants" in response.json()


def test_spc_charts_endpoint():
    response = client.get("/api/cq/spc/charts")

    assert response.status_code == 200
    assert "data" in response.json()


def test_lab_fails_endpoint():
    response = client.get("/api/cq/lab/fails")

    assert response.status_code == 200
    assert "fails" in response.json()


def test_alarms_endpoint():
    response = client.get("/api/cq/alarms")

    assert response.status_code == 200
    assert "alarms" in response.json()
