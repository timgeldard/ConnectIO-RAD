"""Router tests for GET /api/plants."""

from __future__ import annotations

from unittest.mock import AsyncMock

from fastapi.testclient import TestClient

from processorderhistory_backend.main import app
import processorderhistory_backend.routers.plants_router as plants_router

client = TestClient(app)


def test_list_plants_returns_application_payload(monkeypatch) -> None:
    """The router stays transport-only and delegates plant discovery to application services."""
    monkeypatch.setattr(plants_router, "check_warehouse_config", lambda: None)
    mock = AsyncMock(return_value={"plants": [{"plant_id": "P001", "plant_name": "Plant 1"}]})
    monkeypatch.setattr(plants_router, "list_visible_plants", mock)

    response = client.get("/api/poh/plants")

    assert response.status_code == 200
    assert response.json() == {"plants": [{"plant_id": "P001", "plant_name": "Plant 1"}]}
    mock.assert_called_once_with("token")
