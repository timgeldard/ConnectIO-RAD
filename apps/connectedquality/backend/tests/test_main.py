"""Smoke tests for ConnectedQuality connectedquality_backend API."""

from fastapi.testclient import TestClient
from unittest.mock import patch
import pytest

from connectedquality_backend.main import app
import connectedquality_backend.main as main_module
from shared_auth.identity import UserIdentity, require_proxy_user

from shared_manufacturing import test_data

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
    mat_id = test_data.material_id()
    b_id = test_data.batch_id()
    mock_fetch.return_value = {"batch": b_id, "customers_affected": 11}
    response = client.get(f"/api/cq/trace/recall?material={mat_id}&batch={b_id}")

    assert response.status_code == 200
    data = response.json()
    assert data["batch"] == b_id
    assert "customers_affected" in data


@patch("connectedquality_backend.routers.envmon.fetch_active_plant_ids")
@patch("connectedquality_backend.routers.envmon.fetch_plant_metadata")
@patch("connectedquality_backend.routers.envmon.fetch_plant_kpis")
def test_envmon_plants_returns_list(mock_fetch_kpis, mock_fetch_meta, mock_fetch_ids):
    plant = test_data.PLANTS[0]
    mock_fetch_ids.return_value = [plant]
    mock_fetch_meta.return_value = [{"PLANT_ID": plant, "PLANT_NAME": "Charleville"}]
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
    plant = test_data.PLANTS[0]
    response = client.get(f"/api/cq/envmon/history?plant_id={plant}&floor=F2")

    assert response.status_code == 200
    assert response.json()["data_available"] is False


def test_spc_charts_endpoint():
    mat_id = test_data.material_id()
    mic = test_data.mic_id()
    response = client.get(f"/api/cq/spc/charts?material={mat_id}&char={mic}")

    assert response.status_code == 200
    assert "data" in response.json()


@patch("connectedquality_backend.routers.spc.fetch_scorecard")
def test_spc_scorecard_returns_rows(mock_fetch_scorecard):
    mic = test_data.mic_id()
    mat_id = test_data.material_id()
    mock_fetch_scorecard.return_value = [{"mic_id": mic, "is_stable": True}]

    response = client.get(f"/api/cq/spc/scorecard?material={mat_id}")

    assert response.status_code == 200
    assert response.json()["rows"] == [{"mic_id": mic, "is_stable": True}]


@patch("connectedquality_backend.routers.spc.fetch_process_flow")
def test_spc_flow_returns_nodes_and_edges(mock_fetch_process_flow):
    mat_id = test_data.material_id()
    mock_fetch_process_flow.return_value = {
        "nodes": [{"id": "mix"}],
        "edges": [{"id": "mix-pack"}],
    }

    response = client.get(f"/api/cq/spc/flow?material={mat_id}")

    assert response.status_code == 200
    assert response.json()["stages"] == [{"id": "mix"}]
    assert response.json()["edges"] == [{"id": "mix-pack"}]


@patch("connectedquality_backend.routers.lab.fetch_lab_failures")
def test_lab_fails_endpoint(mock_fetch_lab_failures):
    plant = test_data.PLANTS[0]
    lot_id = test_data.inspection_lot()
    mock_fetch_lab_failures.return_value = {"fails": [{"lot": lot_id}], "data_available": True}

    response = client.get(f"/api/cq/lab/fails?plant_id={plant}")

    assert response.status_code == 200
    assert response.json()["fails"] == [{"lot": lot_id}]
    mock_fetch_lab_failures.assert_called_once_with("test_token", plant_id=plant, lot_type=None)


@patch("connectedquality_backend.routers.lab.fetch_lab_plants")
def test_lab_plants_endpoint(mock_fetch_lab_plants):
    plant = test_data.PLANTS[0]
    mock_fetch_lab_plants.return_value = {
        "plants": [{"plant_id": plant, "plant_name": "Charleville"}]
    }

    response = client.get("/api/cq/lab/plants")

    assert response.status_code == 200
    assert response.json() == {
        "plants": [{"plant_id": plant, "plant_name": "Charleville"}]
    }
    mock_fetch_lab_plants.assert_called_once_with("test_token")


@patch("connectedquality_backend.routers.trace.fetch_top_down")
@patch("connectedquality_backend.routers.trace.fetch_bottom_up")
def test_trace_lineage_merges_upstream_and_downstream(mock_bottom_up, mock_top_down):
    mat_id = test_data.material_id()
    b_id = test_data.batch_id()
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

    response = client.get(f"/api/cq/trace/lineage?material={mat_id}&batch={b_id}")

    assert response.status_code == 200
    data = response.json()
    assert data["upstream_depth"] == 2
    assert data["downstream_depth"] == 3
    assert {node["id"] for node in data["nodes"]} == {"raw", "fg", "ship"}
    assert {edge["id"] for edge in data["edges"]} == {"raw-fg", "fg-ship"}


@patch("connectedquality_backend.routers.trace.fetch_mass_balance")
def test_trace_mass_balance_returns_payload(mock_fetch_mass_balance):
    mat_id = test_data.material_id()
    b_id = test_data.batch_id()
    mock_fetch_mass_balance.return_value = {"variance_qty": 0}

    response = client.get(f"/api/cq/trace/mass-balance?material={mat_id}&batch={b_id}")

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
