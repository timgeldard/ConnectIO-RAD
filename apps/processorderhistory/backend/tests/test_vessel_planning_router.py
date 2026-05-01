"""Router tests for POST /api/vessel-planning/analytics."""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock

from backend.main import app
import backend.routers.vessel_planning_router as vessel_planning_router

client = TestClient(app)

_ANALYTICS_PAYLOAD = {
    "now_ms": 1700000000000,
    "kpis": {
        "released_po_count": 5,
        "constrained_po_count": 2,
        "available_vessel_count": 3,
        "dirty_vessel_count": 1,
        "in_use_vessel_count": 2,
        "unknown_vessel_count": 1,
        "unblock_action_count": 2,
    },
    "vessels": [],
    "released_orders": [],
    "daily30d": [],
    "equipment_events": [],
}


@pytest.fixture
def mock_analytics(monkeypatch):
    monkeypatch.setattr(vessel_planning_router, "check_warehouse_config", lambda: None)
    monkeypatch.setattr(vessel_planning_router, "validate_timezone", lambda tz: tz or "UTC")
    mock = AsyncMock(return_value=_ANALYTICS_PAYLOAD)
    monkeypatch.setattr(vessel_planning_router, "fetch_vessel_planning_analytics", mock)
    return mock


def test_post_vessel_planning_analytics_returns_200(mock_analytics):
    response = client.post("/api/vessel-planning/analytics", json={})
    assert response.status_code == 200
    data = response.json()
    for key in ("now_ms", "kpis", "vessels", "released_orders", "daily30d", "equipment_events"):
        assert key in data, f"Missing key: {key}"


def test_post_vessel_planning_analytics_empty_body_calls_dal(mock_analytics):
    client.post("/api/vessel-planning/analytics", json={})
    mock_analytics.assert_called_once_with(
        "token", plant_id=None, date_from=None, date_to=None, timezone="UTC"
    )


def test_post_vessel_planning_analytics_passes_plant_id(mock_analytics):
    client.post("/api/vessel-planning/analytics", json={"plant_id": "RCN1"})
    mock_analytics.assert_called_once_with("token", plant_id="RCN1", date_from=None, date_to=None, timezone="UTC")


def test_post_vessel_planning_analytics_passes_date_range(mock_analytics):
    client.post("/api/vessel-planning/analytics", json={"date_from": "2024-01-01", "date_to": "2024-01-07"})
    mock_analytics.assert_called_once_with(
        "token", plant_id=None, date_from="2024-01-01", date_to="2024-01-07", timezone="UTC"
    )


def test_post_vessel_planning_analytics_passes_timezone(mock_analytics):
    client.post("/api/vessel-planning/analytics", json={"timezone": "Europe/London"})
    mock_analytics.assert_called_once_with("token", plant_id=None, date_from=None, date_to=None, timezone="Europe/London")


def test_post_vessel_planning_analytics_kpi_shape(mock_analytics):
    response = client.post("/api/vessel-planning/analytics", json={})
    kpis = response.json()["kpis"]
    for key in (
        "released_po_count", "constrained_po_count", "available_vessel_count",
        "dirty_vessel_count", "in_use_vessel_count", "unknown_vessel_count", "unblock_action_count"
    ):
        assert key in kpis, f"Missing KPI key: {key}"
