import asyncio

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch

from spc_backend.main import app
import spc_backend.process_control.router_metadata as meta_router
import spc_backend.process_control.application.metadata as meta_app

client = TestClient(app)

@pytest.fixture
def mock_meta_dal(monkeypatch):
    monkeypatch.setattr(meta_router, "fetch_materials", AsyncMock(return_value=[]))
    monkeypatch.setattr(meta_router, "fetch_characteristics", AsyncMock(return_value=([], [])))
    monkeypatch.setattr(meta_router, "check_warehouse_config", lambda: None)
    monkeypatch.setattr(meta_router, "attach_data_freshness", AsyncMock(side_effect=lambda data, *args, **kwargs: data))
    return {}

def test_materials_endpoint(mock_meta_dal):
    # Prefix is /api/spc, route is /materials
    response = client.get("/api/spc/materials")
    assert response.status_code == 200
    assert response.json() == {"materials": []}

def test_characteristics_endpoint(mock_meta_dal):
    # Prefix is /api/spc, route is /characteristics (POST)
    response = client.post(
        "/api/spc/characteristics",
        json={"material_id": "MAT1", "plant_id": "P1"}
    )
    assert response.status_code == 200
    assert response.json() == {"characteristics": [], "attr_characteristics": []}

def test_plants_endpoint(mock_meta_dal, monkeypatch):
    monkeypatch.setattr(meta_router, "fetch_plants", AsyncMock(return_value=[]))
    response = client.get("/api/spc/plants?material_id=MAT1")
    assert response.status_code == 200
    assert "plants" in response.json()

def test_validate_material_endpoint(mock_meta_dal, monkeypatch):
    monkeypatch.setattr(meta_router, "validate_material", AsyncMock(return_value={"material_id": "MAT1", "material_name": "Name"}))
    monkeypatch.setattr(meta_router, "attach_validation_freshness", AsyncMock(side_effect=lambda data, *args, **kwargs: data))
    response = client.post("/api/spc/validate-material", json={"material_id": "MAT1"})
    assert response.status_code == 200
    assert response.json()["valid"] is True

def test_attribute_characteristics_endpoint(mock_meta_dal, monkeypatch):
    monkeypatch.setattr(meta_router, "fetch_attribute_characteristics", AsyncMock(return_value=[]))
    response = client.post(
        "/api/spc/attribute-characteristics",
        json={"material_id": "MAT1", "plant_id": "P1"}
    )
    assert response.status_code == 200
    assert "characteristics" in response.json()

def test_validate_material_not_found(mock_meta_dal, monkeypatch):
    monkeypatch.setattr(meta_router, "validate_material", AsyncMock(return_value=None))
    monkeypatch.setattr(meta_router, "attach_validation_freshness", AsyncMock(side_effect=lambda data, *args, **kwargs: data))
    response = client.post("/api/spc/validate-material", json={"material_id": "MISSING"})
    assert response.status_code == 200
    assert response.json()["valid"] is False


# ---------------------------------------------------------------------------
# fetch_plants intersection tests (application layer)
# ---------------------------------------------------------------------------

def test_fetch_plants_intersects_authorized_scope(monkeypatch):
    """Only plants that are both material-data plants AND authorized are returned."""
    import spc_backend.process_control.dal.metadata as meta_dal
    material_plants = [
        {"plant_id": "IE01", "plant_name": "Ireland"},
        {"plant_id": "DE01", "plant_name": "Germany"},
    ]
    monkeypatch.setattr(meta_dal, "_fetch_material_plants", AsyncMock(return_value=material_plants))
    monkeypatch.setattr(meta_app, "fetch_authorized_plants", AsyncMock(return_value=["IE01"]))
    result = asyncio.run(meta_app.fetch_plants("tok", "MAT1"))
    assert result == [{"plant_id": "IE01", "plant_name": "Ireland"}]


def test_fetch_plants_empty_when_no_authorized(monkeypatch):
    """Empty list returned when user is authorized for no plants."""
    import spc_backend.process_control.dal.metadata as meta_dal
    monkeypatch.setattr(
        meta_dal, "_fetch_material_plants",
        AsyncMock(return_value=[{"plant_id": "IE01", "plant_name": "Ireland"}]),
    )
    monkeypatch.setattr(meta_app, "fetch_authorized_plants", AsyncMock(return_value=[]))
    result = asyncio.run(meta_app.fetch_plants("tok", "MAT1"))
    assert result == []


def test_assert_plant_authorized_raises_403(monkeypatch):
    """assert_plant_authorized raises HTTP 403 for an unauthorized plant."""
    import spc_backend.process_control.dal.authorized_scope as scope_dal
    monkeypatch.setattr(scope_dal, "fetch_authorized_plants", AsyncMock(return_value=["IE01"]))
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(scope_dal.assert_plant_authorized("tok", "DE01"))
    assert exc_info.value.status_code == 403
    assert "DE01" in exc_info.value.detail


def test_assert_plant_authorized_noop_for_none(monkeypatch):
    """No DB call and no exception when plant_id is None (global scope)."""
    import spc_backend.process_control.dal.authorized_scope as scope_dal
    mock = AsyncMock(return_value=[])
    monkeypatch.setattr(scope_dal, "fetch_authorized_plants", mock)
    asyncio.run(scope_dal.assert_plant_authorized("tok", None))
    mock.assert_not_called()
