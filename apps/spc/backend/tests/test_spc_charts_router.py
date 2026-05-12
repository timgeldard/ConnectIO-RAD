import pytest
from fastapi.testclient import TestClient
from shared_manufacturing import test_data
from spc_backend.main import app
import spc_backend.process_control.router_charts as charts_router
import spc_backend.chart_config.router as chart_config_router
from unittest.mock import AsyncMock

client = TestClient(app)

@pytest.fixture
def mock_charts_dal(monkeypatch):
    mocks = {
        "fetch_chart_data_page": AsyncMock(return_value={"data": [], "next_cursor": None, "has_more": False}),
        "fetch_data_quality_summary": AsyncMock(return_value={}),
        "fetch_control_limits": AsyncMock(return_value={"cl": 10, "ucl": 12, "lcl": 8}),
        "fetch_p_chart_data": AsyncMock(return_value={"data": []}),
        "fetch_count_chart_data": AsyncMock(return_value={"data": []}),
    }
    for name, m in mocks.items():
        monkeypatch.setattr(charts_router, name, m)
    monkeypatch.setattr(charts_router, "check_warehouse_config", lambda: None)
    monkeypatch.setattr(charts_router, "attach_data_freshness", AsyncMock(side_effect=lambda data, *args, **kwargs: data))
    return type("Mocks", (), mocks)

@pytest.fixture
def mock_locked_limits_dal(monkeypatch):
    import spc_backend.chart_config.application.commands as chart_config_commands

    mocks = {
        "get_limits": AsyncMock(return_value=None),
        "lock_limits": AsyncMock(return_value={"saved": True}),
        "delete_limits": AsyncMock(return_value={"deleted": True}),
    }
    for name, m in mocks.items():
        monkeypatch.setattr(chart_config_commands, name, m)
    monkeypatch.setattr(chart_config_router, "check_warehouse_config", lambda: None)
    return type("Mocks", (), mocks)


def test_chart_data_endpoint(mock_charts_dal):
    mat_id = test_data.material_id()
    mic = test_data.mic_id()
    response = client.post(
        "/api/spc/chart-data",
        json={"material_id": mat_id, "mic_id": mic}
    )
    assert response.status_code == 200
    assert "data" in response.json()
    mock_charts_dal.fetch_chart_data_page.assert_called_once()
    args, kwargs = mock_charts_dal.fetch_chart_data_page.call_args
    # token, material_id, mic_id, ...
    assert args[1] == mat_id
    assert args[2] == mic

def test_chart_data_endpoint_negative():
    mic = test_data.mic_id()
    response = client.post(
        "/api/spc/chart-data",
        json={"mic_id": mic}
    )
    assert response.status_code == 422

def test_data_quality_endpoint(mock_charts_dal):
    mat_id = test_data.material_id()
    mic = test_data.mic_id()
    response = client.post(
        "/api/spc/data-quality",
        json={"material_id": mat_id, "mic_id": mic}
    )
    assert response.status_code == 200

def test_control_limits_endpoint(mock_charts_dal):
    mat_id = test_data.material_id()
    mic = test_data.mic_id()
    plant = test_data.PLANTS[0]
    response = client.post(
        "/api/spc/control-limits",
        json={"material_id": mat_id, "mic_id": mic, "plant_id": plant, "chart_type": "imr"}
    )
    assert response.status_code == 200
    mock_charts_dal.fetch_control_limits.assert_called_once()
    args, kwargs = mock_charts_dal.fetch_control_limits.call_args
    assert args[1] == mat_id
    assert args[2] == mic
    assert args[3] == plant
    resp_data = response.json()
    assert "control_limits" in resp_data
    assert "cl" in resp_data["control_limits"]

def test_p_chart_data_endpoint(mock_charts_dal):
    mat_id = test_data.material_id()
    mic = test_data.mic_id()
    response = client.post(
        "/api/spc/p-chart-data",
        json={"material_id": mat_id, "mic_id": mic}
    )
    assert response.status_code == 200
    mock_charts_dal.fetch_p_chart_data.assert_called_once()
    args, kwargs = mock_charts_dal.fetch_p_chart_data.call_args
    assert args[1] == mat_id
    assert args[2] == mic
    resp_data = response.json()
    assert "points" in resp_data
    assert "data" in resp_data["points"]

def test_count_chart_data_endpoint(mock_charts_dal):
    mat_id = test_data.material_id()
    mic = test_data.mic_id()
    response = client.post(
        "/api/spc/count-chart-data",
        json={"material_id": mat_id, "mic_id": mic, "chart_subtype": "u"}
    )
    assert response.status_code == 200
    mock_charts_dal.fetch_count_chart_data.assert_called_once()

def test_locked_limits_endpoints(mock_locked_limits_dal):
    mat_id = test_data.material_id()
    mic = test_data.mic_id()
    # GET
    response = client.get(f"/api/spc/locked-limits?material_id={mat_id}&mic_id={mic}")
    assert response.status_code == 200
    mock_locked_limits_dal.get_limits.assert_called_once()

    # POST
    payload = {
        "material_id": mat_id, "mic_id": mic, "chart_type": "imr",
        "cl": 10, "ucl": 12, "lcl": 8
    }
    response = client.post("/api/spc/lock-limits", json=payload)
    assert response.status_code == 200
    mock_locked_limits_dal.lock_limits.assert_called_once()
    assert response.json()["saved"] is True

    # DELETE
    response = client.request(
        "DELETE", "/api/spc/locked-limits",
        json={"material_id": mat_id, "mic_id": mic, "chart_type": "imr"}
    )
    assert response.status_code == 200
    mock_locked_limits_dal.delete_limits.assert_called_once()
