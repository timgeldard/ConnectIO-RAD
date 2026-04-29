"""Router tests for POST /api/downtime/analytics."""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock

from backend.main import app
import backend.routers.downtime_router as downtime_router

client = TestClient(app)

_DOWNTIME_PAYLOAD = {
    "now_ms": 1700000000000,
    "reasons": [],
    "daily30d": [],
}


@pytest.fixture
def mock_downtime(monkeypatch):
    monkeypatch.setattr(downtime_router, "resolve_token", lambda *_: "token")
    monkeypatch.setattr(downtime_router, "check_warehouse_config", lambda: None)
    mock = AsyncMock(return_value=_DOWNTIME_PAYLOAD)
    monkeypatch.setattr(downtime_router, "fetch_downtime_analytics", mock)
    return mock


def test_post_downtime_analytics_returns_200(mock_downtime):
    response = client.post("/api/downtime/analytics", json={})
    assert response.status_code == 200
    data = response.json()
    assert "now_ms" in data
    assert "reasons" in data
    assert "daily30d" in data
    mock_downtime.assert_called_once_with(
        "token", plant_id=None, date_from=None, date_to=None, timezone="UTC"
    )


def test_post_downtime_analytics_passes_plant_id(mock_downtime):
    client.post("/api/downtime/analytics", json={"plant_id": "P001"})
    mock_downtime.assert_called_once_with(
        "token", plant_id="P001", date_from=None, date_to=None, timezone="UTC"
    )


def test_post_downtime_analytics_passes_date_range(mock_downtime):
    client.post("/api/downtime/analytics", json={"date_from": "2024-01-01", "date_to": "2024-01-07"})
    mock_downtime.assert_called_once_with(
        "token", plant_id=None, date_from="2024-01-01", date_to="2024-01-07", timezone="UTC"
    )


def test_post_downtime_analytics_passes_timezone(mock_downtime):
    client.post("/api/downtime/analytics", json={"timezone": "Europe/London"})
    mock_downtime.assert_called_once_with(
        "token", plant_id=None, date_from=None, date_to=None, timezone="Europe/London"
    )
