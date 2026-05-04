"""Router tests for POST /api/adherence."""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock

from backend.main import app
import backend.manufacturing_analytics.router_adherence as adherence_router

client = TestClient(app)

_ADHERENCE_PAYLOAD = {
    "now_ms": 1700000000000,
    "orders": [],
    "daily30d": [],
}


@pytest.fixture
def mock_adherence(monkeypatch):
    monkeypatch.setattr(adherence_router, "check_warehouse_config", lambda: None)
    mock = AsyncMock(return_value=_ADHERENCE_PAYLOAD)
    monkeypatch.setattr(adherence_router, "fetch_adherence_analytics", mock)
    return mock


def test_post_adherence_analytics_returns_200(mock_adherence):
    response = client.post("/api/adherence", json={})
    assert response.status_code == 200
    data = response.json()
    assert "now_ms" in data
    assert "orders" in data
    assert "daily30d" in data
    mock_adherence.assert_called_once_with(
        "token", plant_id=None, date_from=None, date_to=None, request_path="/api/adherence"
    )


def test_post_adherence_analytics_passes_plant_id(mock_adherence):
    client.post("/api/adherence", json={"plant_id": "P001"})
    mock_adherence.assert_called_once_with(
        "token", plant_id="P001", date_from=None, date_to=None, request_path="/api/adherence"
    )


def test_post_adherence_analytics_passes_date_range(mock_adherence):
    client.post("/api/adherence", json={"date_from": "2024-01-01", "date_to": "2024-01-07"})
    mock_adherence.assert_called_once_with(
        "token", plant_id=None, date_from="2024-01-01", date_to="2024-01-07", request_path="/api/adherence"
    )


def test_post_adherence_analytics_ignores_unknown_timezone(mock_adherence):
    client.post("/api/adherence", json={"timezone": "Europe/London"})
    mock_adherence.assert_called_once_with(
        "token", plant_id=None, date_from=None, date_to=None, request_path="/api/adherence"
    )
