"""Router tests for POST /api/yield."""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock

from backend.main import app
import backend.manufacturing_analytics.router_yield as yield_router

client = TestClient(app)

_YIELD_PAYLOAD = {
    "now_ms": 1700000000000,
    "target_yield_pct": 95.0,
    "materials": ["Sugar"],
    "orders": [],
    "prior7d": [],
    "daily30d": [],
    "hourly24h": [],
}


@pytest.fixture
def mock_yield(monkeypatch):
    monkeypatch.setattr(yield_router, "check_warehouse_config", lambda: None)
    mock = AsyncMock(return_value=_YIELD_PAYLOAD)
    monkeypatch.setattr(yield_router.analytics_queries, "get_yield_analytics", mock)
    return mock


def test_post_yield_analytics_returns_200(mock_yield):
    response = client.post("/api/yield", json={})
    assert response.status_code == 200
    data = response.json()
    assert "now_ms" in data
    assert "orders" in data
    mock_yield.assert_called_once_with(
        "token", plant_id=None, date_from=None, date_to=None
    )


def test_post_yield_analytics_passes_plant_id(mock_yield):
    client.post("/api/yield", json={"plant_id": "P001"})
    mock_yield.assert_called_once_with(
        "token", plant_id="P001", date_from=None, date_to=None
    )


def test_post_yield_analytics_passes_date_range(mock_yield):
    client.post("/api/yield", json={"date_from": "2024-01-01", "date_to": "2024-01-07"})
    mock_yield.assert_called_once_with(
        "token", plant_id=None, date_from="2024-01-01", date_to="2024-01-07"
    )


def test_post_yield_analytics_ignores_unknown_timezone(mock_yield):
    client.post("/api/yield", json={"timezone": "Australia/Sydney"})
    mock_yield.assert_called_once_with(
        "token", plant_id=None, date_from=None, date_to=None
    )


def test_post_yield_analytics_returns_full_shape(mock_yield):
    response = client.post("/api/yield", json={})
    data = response.json()
    for key in ("now_ms", "target_yield_pct", "materials", "orders", "prior7d", "daily30d", "hourly24h"):
        assert key in data, f"Missing key: {key}"
