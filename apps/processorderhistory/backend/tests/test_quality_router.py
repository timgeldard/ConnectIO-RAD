"""Router tests for POST /api/quality/analytics."""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock

from backend.main import app
import backend.manufacturing_analytics.router_quality as quality_router

client = TestClient(app)

_QUALITY_PAYLOAD = {
    "now_ms": 1700000000000,
    "materials": ["Sugar"],
    "rows": [],
    "prior7d": [],
    "daily30d": [],
    "hourly24h": [],
}


@pytest.fixture
def mock_quality(monkeypatch):
    monkeypatch.setattr(quality_router, "check_warehouse_config", lambda: None)
    mock = AsyncMock(return_value=_QUALITY_PAYLOAD)
    monkeypatch.setattr(quality_router, "fetch_quality_analytics", mock)
    return mock


def test_post_quality_analytics_returns_200(mock_quality):
    response = client.post("/api/quality/analytics", json={})
    assert response.status_code == 200
    data = response.json()
    assert "now_ms" in data
    assert "rows" in data
    mock_quality.assert_called_once_with(
        "token", plant_id=None, date_from=None, date_to=None, timezone="UTC"
    )


def test_post_quality_analytics_passes_plant_id(mock_quality):
    client.post("/api/quality/analytics", json={"plant_id": "P001"})
    mock_quality.assert_called_once_with(
        "token", plant_id="P001", date_from=None, date_to=None, timezone="UTC"
    )


def test_post_quality_analytics_passes_date_range(mock_quality):
    client.post("/api/quality/analytics", json={"date_from": "2024-01-01", "date_to": "2024-01-07"})
    mock_quality.assert_called_once_with(
        "token", plant_id=None, date_from="2024-01-01", date_to="2024-01-07", timezone="UTC"
    )


def test_post_quality_analytics_passes_timezone(mock_quality):
    client.post("/api/quality/analytics", json={"timezone": "Europe/London"})
    mock_quality.assert_called_once_with(
        "token", plant_id=None, date_from=None, date_to=None, timezone="Europe/London"
    )


def test_post_quality_analytics_returns_full_shape(mock_quality):
    response = client.post("/api/quality/analytics", json={})
    data = response.json()
    for key in ("now_ms", "materials", "rows", "prior7d", "daily30d", "hourly24h"):
        assert key in data, f"Missing key: {key}"
