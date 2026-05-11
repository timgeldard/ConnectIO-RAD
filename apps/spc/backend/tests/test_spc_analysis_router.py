import pytest
from fastapi.testclient import TestClient
from shared_domain import test_data
from spc_backend.main import app
import spc_backend.process_control.router_analysis as spc_router
from unittest.mock import AsyncMock

client = TestClient(app)

@pytest.fixture
def mock_spc_dal(monkeypatch):
    mock_payload = {"test": "data"}
    monkeypatch.setattr(spc_router, "fetch_process_flow", AsyncMock(return_value=mock_payload))
    monkeypatch.setattr(spc_router, "fetch_scorecard", AsyncMock(return_value=[]))
    monkeypatch.setattr(spc_router, "fetch_correlation", AsyncMock(return_value=mock_payload))
    monkeypatch.setattr(spc_router, "fetch_correlation_scatter", AsyncMock(return_value=[]))
    monkeypatch.setattr(spc_router, "fetch_multivariate", AsyncMock(return_value=mock_payload))
    monkeypatch.setattr(spc_router, "check_warehouse_config", lambda: None)
    # Mock attach_data_freshness to just return the data
    monkeypatch.setattr(spc_router, "attach_data_freshness", AsyncMock(side_effect=lambda data, *args, **kwargs: data))
    return mock_payload

def test_scorecard_endpoint(mock_spc_dal):
    mat_id = test_data.material_id()
    plant = test_data.PLANTS[0]
    response = client.post(
        "/api/spc/scorecard",
        json={"material_id": mat_id, "plant_id": plant}
    )
    assert response.status_code == 200
    assert "scorecard" in response.json()

def test_process_flow_endpoint(mock_spc_dal):
    mat_id = test_data.material_id()
    response = client.post(
        "/api/spc/process-flow",
        json={"material_id": mat_id}
    )
    assert response.status_code == 200
    assert response.json() == mock_spc_dal

def test_correlation_endpoint(mock_spc_dal):
    mat_id = test_data.material_id()
    response = client.post(
        "/api/spc/correlation",
        json={"material_id": mat_id}
    )
    assert response.status_code == 200
    assert response.json() == mock_spc_dal

def test_multivariate_endpoint(mock_spc_dal):
    mat_id = test_data.material_id()
    mic1 = test_data.mic_id()
    mic2 = test_data.mic_id()
    response = client.post(
        "/api/spc/multivariate",
        json={"material_id": mat_id, "mic_ids": [mic1, mic2]}
    )
    assert response.status_code == 200
    assert response.json() == mock_spc_dal

def test_msa_calculate_endpoint():
    # Test average_range
    response = client.post(
        "/api/spc/msa/calculate",
        headers={"x-forwarded-access-token": "token"},
        json={
            "measurement_data": [[[1, 1.1], [2, 2.1]], [[1.1, 1.2], [2.1, 2.2]]],
            "tolerance": 1.0,
            "method": "average_range"
        }
    )
    assert response.status_code == 200
    assert response.json()["method"] == "average_range"

    # Test anova
    response = client.post(
        "/api/spc/msa/calculate",
        headers={"x-forwarded-access-token": "token"},
        json={
            "measurement_data": [[[1, 1.1], [2, 2.1]], [[1.1, 1.2], [2.1, 2.2]]],
            "tolerance": 1.0,
            "method": "anova"
        }
    )
    assert response.status_code == 200
    assert response.json()["method"] == "anova"

def test_msa_save_endpoint(mock_spc_dal, monkeypatch):
    mat_id = test_data.material_id()
    mic = test_data.mic_id()
    monkeypatch.setattr(spc_router, "save_msa_session", AsyncMock(return_value={"saved": True}))
    response = client.post(
        "/api/spc/msa/save",
        headers={"x-forwarded-access-token": "token"},
        json={
            "material_id": mat_id,
            "mic_id": mic,
            "n_operators": 2,
            "n_parts": 2,
            "n_replicates": 2,
            "grr_pct": 10.0,
            "repeatability": 0.1,
            "reproducibility": 0.1,
            "ndc": 5.0,
            "results_json": "{}"
        }
    )
    assert response.status_code == 200
    assert response.json()["saved"] is True

def test_compare_scorecard_endpoint(mock_spc_dal, monkeypatch):
    mat1 = test_data.material_id()
    mat2 = test_data.material_id()
    plant = test_data.PLANTS[0]
    monkeypatch.setattr(spc_router, "fetch_compare_scorecard", AsyncMock(return_value=[]))
    response = client.post(
        "/api/spc/compare-scorecard",
        headers={"x-forwarded-access-token": "token"},
        json={
            "material_ids": [mat1, mat2],
            "plant_id": plant
        }
    )
    assert response.status_code == 200
    assert response.json() == []
