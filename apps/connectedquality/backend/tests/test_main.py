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
    response = client.get("/api/cq/trace/recall?material=MAT1&batch=B1")

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


@patch("connectedquality_backend.routers.envmon.fetch_active_plant_ids")
def test_envmon_plants_returns_empty_list(mock_fetch_ids):
    mock_fetch_ids.return_value = []

    response = client.get("/api/cq/envmon/plants")

    assert response.status_code == 200
    assert response.json() == {"plants": []}


def test_envmon_history_reports_pending_gold_views():
    response = client.get("/api/cq/envmon/history?plant_id=CHV&floor=F2")

    assert response.status_code == 200
    assert response.json()["data_available"] is False


def test_spc_charts_endpoint():
    response = client.get("/api/cq/spc/charts?material=MAT1&char=MIC1")

    assert response.status_code == 200
    assert "data" in response.json()


@patch("connectedquality_backend.routers.spc.fetch_scorecard")
def test_spc_scorecard_returns_rows(mock_fetch_scorecard):
    mock_fetch_scorecard.return_value = [{"mic_id": "M1", "is_stable": True}]

    response = client.get("/api/cq/spc/scorecard?material=MAT1")

    assert response.status_code == 200
    assert response.json()["rows"] == [{"mic_id": "M1", "is_stable": True}]


@patch("connectedquality_backend.routers.spc.fetch_process_flow")
def test_spc_flow_returns_nodes_and_edges(mock_fetch_process_flow):
    mock_fetch_process_flow.return_value = {
        "nodes": [{"id": "mix"}],
        "edges": [{"id": "mix-pack"}],
    }

    response = client.get("/api/cq/spc/flow?material=MAT1")

    assert response.status_code == 200
    assert response.json()["stages"] == [{"id": "mix"}]
    assert response.json()["edges"] == [{"id": "mix-pack"}]


def test_lab_fails_endpoint():
    response = client.get("/api/cq/lab/fails?plant_id=CHV")

    assert response.status_code == 200
    assert "fails" in response.json()


@patch("connectedquality_backend.routers.trace.fetch_top_down")
@patch("connectedquality_backend.routers.trace.fetch_bottom_up")
def test_trace_lineage_merges_upstream_and_downstream(mock_bottom_up, mock_top_down):
    mock_bottom_up.return_value = {
        "max_depth": 2,
        "nodes": [{"id": "raw"}, {"id": "fg"}],
        "edges": [{"id": "raw-fg"}],
    }
    mock_top_down.return_value = {
        "max_depth": 3,
        "nodes": [{"id": "fg"}, {"id": "ship"}],
        "edges": [{"id": "fg-ship"}],
    }

    response = client.get("/api/cq/trace/lineage?material=MAT1&batch=B1")

    assert response.status_code == 200
    data = response.json()
    assert data["upstream_depth"] == 2
    assert data["downstream_depth"] == 3
    assert {node["id"] for node in data["nodes"]} == {"raw", "fg", "ship"}
    assert {edge["id"] for edge in data["edges"]} == {"raw-fg", "fg-ship"}


@patch("connectedquality_backend.routers.trace.fetch_mass_balance")
def test_trace_mass_balance_returns_payload(mock_fetch_mass_balance):
    mock_fetch_mass_balance.return_value = {"variance_qty": 0}

    response = client.get("/api/cq/trace/mass-balance?material=MAT1&batch=B1")

    assert response.status_code == 200
    assert response.json() == {"variance_qty": 0}


def test_alarms_endpoint():
    response = client.get("/api/cq/alarms")

    assert response.status_code == 200
    assert "alarms" in response.json()


def test_me_returns_display_name():
    response = client.get("/api/cq/me")

    assert response.status_code == 200
    assert response.json() == {"name": "Test_user", "initials": "T"}


@patch("connectedquality_backend.user_preferences.router_me.get_pinned")
def test_get_preferences_returns_pinned_modules(mock_get_pinned):
    mock_get_pinned.return_value = ["trace", "spc"]

    response = client.get("/api/cq/me/preferences?app_id=connectedquality")

    assert response.status_code == 200
    assert response.json() == {"pinned_modules": ["trace", "spc"]}


@patch("connectedquality_backend.user_preferences.router_me.set_pinned")
def test_save_preferences_persists_pinned_modules(mock_set_pinned):
    response = client.post(
        "/api/cq/me/preferences",
        json={"app_id": "connectedquality", "pinned_modules": ["trace"]},
    )

    assert response.status_code == 200
    assert response.json() == {"ok": True}
    mock_set_pinned.assert_called_once_with("test_user", "connectedquality", ["trace"])
