"""Router tests for POST /api/oee/analytics."""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock

from backend.main import app
import backend.routers.oee_router as oee_router

client = TestClient(app)

_OEE_PAYLOAD = {
    "now_ms": 1700000000000,
    "lines": [],
    "daily30d": [],
}


@pytest.fixture
def mock_oee(monkeypatch):
    monkeypatch.setattr(oee_router, "resolve_token", lambda *_: "token")
    monkeypatch.setattr(oee_router, "check_warehouse_config", lambda: None)
    monkeypatch.setattr(oee_router, "validate_timezone", lambda tz: tz or "UTC")
    mock = AsyncMock(return_value=_OEE_PAYLOAD)
    monkeypatch.setattr(oee_router, "fetch_oee_analytics", mock)
    return mock


def test_post_oee_analytics_returns_200(mock_oee):
    response = client.post("/api/oee/analytics", json={})
    assert response.status_code == 200
    data = response.json()
    assert "now_ms" in data
    assert "lines" in data
    assert "daily30d" in data
    mock_oee.assert_called_once_with(
        "token", plant_id=None, date_from=None, date_to=None, timezone="UTC"
    )


def test_post_oee_analytics_passes_plant_id(mock_oee):
    client.post("/api/oee/analytics", json={"plant_id": "P001"})
    mock_oee.assert_called_once_with(
        "token", plant_id="P001", date_from=None, date_to=None, timezone="UTC"
    )


def test_post_oee_analytics_passes_date_range(mock_oee):
    client.post("/api/oee/analytics", json={"date_from": "2024-01-01", "date_to": "2024-01-07"})
    mock_oee.assert_called_once_with(
        "token", plant_id=None, date_from="2024-01-01", date_to="2024-01-07", timezone="UTC"
    )


def test_post_oee_analytics_passes_timezone(mock_oee):
    client.post("/api/oee/analytics", json={"timezone": "Europe/London"})
    mock_oee.assert_called_once_with(
        "token", plant_id=None, date_from=None, date_to=None, timezone="Europe/London"
    )
