"""Router tests for POST /api/dayview."""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock

from processorderhistory_backend.main import app
import processorderhistory_backend.order_execution.router_day_view as day_view_router

client = TestClient(app)

_DAY_VIEW_PAYLOAD = {
    "day": "2026-04-29",
    "day_start_ms": 1745884800000,
    "day_end_ms": 1745971199999,
    "lines": ["LINE-01"],
    "blocks": [
        {
            "id": "PO001-LINE-01",
            "poId": "PO001",
            "lineId": "LINE-01",
            "start": 1745892000000,
            "end": 1745906400000,
            "kind": "completed",
            "label": "Whey Protein",
            "sublabel": "MAT-001",
            "confirmedQty": 980.0,
            "plannedQty": 1000.0,
            "uom": "KG",
        }
    ],
    "downtime": [],
    "kpis": {
        "orderCount": 1,
        "completedCount": 1,
        "confirmedQty": 980.0,
        "downtimeEvents": 0,
        "downtimeMins": 0.0,
    },
}


@pytest.fixture
def mock_day_view(monkeypatch):
    monkeypatch.setattr(day_view_router, "check_warehouse_config", lambda: None)
    mock = AsyncMock(return_value=_DAY_VIEW_PAYLOAD)
    monkeypatch.setattr(day_view_router.order_queries, "get_day_view", mock)
    return mock


def test_post_dayview_returns_200(mock_day_view):
    response = client.post("/api/dayview", json={})
    assert response.status_code == 200
    data = response.json()
    assert "day" in data
    assert "blocks" in data
    assert "downtime" in data
    assert "kpis" in data
    assert "lines" in data
    mock_day_view.assert_called_once_with("token", day=None, plant_id=None)


def test_post_dayview_passes_day(mock_day_view):
    client.post("/api/dayview", json={"day": "2026-04-29"})
    mock_day_view.assert_called_once_with("token", day="2026-04-29", plant_id=None)


def test_post_dayview_passes_plant_id(mock_day_view):
    client.post("/api/dayview", json={"plant_id": "P001"})
    mock_day_view.assert_called_once_with("token", day=None, plant_id="P001")


def test_post_dayview_returns_full_shape(mock_day_view):
    response = client.post("/api/dayview", json={})
    data = response.json()
    for key in ("day", "day_start_ms", "day_end_ms", "lines", "blocks", "downtime", "kpis"):
        assert key in data, f"Missing key: {key}"
    kpis = data["kpis"]
    for k in ("orderCount", "completedCount", "confirmedQty", "downtimeEvents", "downtimeMins"):
        assert k in kpis, f"Missing kpi key: {k}"
