"""Smoke tests for ConnectedQuality connectedquality_backend API."""

from fastapi.testclient import TestClient
from unittest.mock import patch
import pytest

from connectedquality_backend.main import app
import connectedquality_backend.main as main_module
from shared_auth.identity import UserIdentity, require_proxy_user

def override_require_proxy_user():
    return UserIdentity(user_id="test_user", raw_token="test_token")

@pytest.fixture(autouse=True)
def override_proxy_user_fixture():
    original = app.dependency_overrides.get(require_proxy_user)
    app.dependency_overrides[require_proxy_user] = override_require_proxy_user
    yield
    if original is not None:
        app.dependency_overrides[require_proxy_user] = original
    else:
        del app.dependency_overrides[require_proxy_user]

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


@patch("connectedquality_backend.routers.trace.fetch_recall_readiness")
def test_trace_recall_returns_batch(mock_fetch):
    mock_fetch.return_value = {"batch": "0008898869", "customers_affected": 11}
    response = client.get("/api/cq/trace/recall")

    assert response.status_code == 200
    data = response.json()
    assert "batch" in data
    assert "customers_affected" in data


@patch("connectedquality_backend.routers.envmon.fetch_active_plant_ids")
@patch("connectedquality_backend.routers.envmon.fetch_plant_metadata")
@patch("connectedquality_backend.routers.envmon.fetch_plant_kpis")
def test_envmon_plants_returns_list(mock_fetch_kpis, mock_fetch_meta, mock_fetch_ids):
    mock_fetch_ids.return_value = ["CHV"]
    mock_fetch_meta.return_value = [{"PLANT_ID": "CHV", "PLANT_NAME": "Charleville"}]
    mock_fetch_kpis.return_value = [{"active_fails": 0, "warnings": 0}]
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
