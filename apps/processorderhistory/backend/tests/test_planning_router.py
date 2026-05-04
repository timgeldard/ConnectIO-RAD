"""Router tests for POST /api/planning/schedule."""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock

from backend.main import app
import backend.production_planning.router_planning as planning_router

client = TestClient(app)

_SCHEDULE_PAYLOAD = {
    "now_ms": 1700000000000,
    "today_ms": 1699920000000,
    "window_start_ms": 1699827200000,
    "window_end_ms": 1700259200000,
    "lines": ["MIX-04", "SPD-02"],
    "blocks": [
        {
            "id": "PO001-MIX-04",
            "poId": "PO001",
            "lineId": "MIX-04",
            "start": 1700000000000,
            "end": 1700028800000,
            "kind": "running",
            "label": "Test Product",
            "sublabel": "MAT001",
            "qty": 0,
            "uom": "KG",
            "materialId": "MAT001",
            "customer": None,
            "shift": None,
            "operator": None,
            "ratePerH": None,
            "materials": [],
            "shortageETA": None,
            "shortageItem": None,
            "activeDowntime": None,
        }
    ],
    "backlog": [
        {
            "id": "bl-BL001",
            "poId": "BL001",
            "product": "Backlog Product",
            "materialId": "MAT002",
            "category": None,
            "qty": 0,
            "uom": "KG",
            "due": 1700604800000,
            "priority": "normal",
            "customer": "—",
            "requiresLine": "—",
            "durationH": 8,
        }
    ],
    "kpis": {
        "runningCount": 1,
        "totalLines": 2,
        "todaysQty": 0,
        "todaysCount": 0,
        "utilization": 0,
        "onTimePct": 0,
        "atRiskCount": 0,
        "materialShortCount": 0,
        "wmInTransit": 0,
        "downtimeMinsToday": 0,
        "activeDowntimeCount": 0,
        "backlogCount": 1,
        "backlogUrgent": 0,
    },
}


@pytest.fixture
def mock_schedule(monkeypatch):
    monkeypatch.setattr(planning_router, "check_warehouse_config", lambda: None)
    mock = AsyncMock(return_value=_SCHEDULE_PAYLOAD)
    monkeypatch.setattr(planning_router, "fetch_planning_schedule", mock)
    return mock


def test_post_planning_schedule_returns_200(mock_schedule):
    response = client.post("/api/planning/schedule", json={})
    assert response.status_code == 200
    data = response.json()
    assert data["lines"] == ["MIX-04", "SPD-02"]
    assert len(data["blocks"]) == 1
    assert len(data["backlog"]) == 1
    mock_schedule.assert_called_once_with("token", plant_id=None)


def test_post_planning_schedule_passes_plant_id(mock_schedule):
    client.post("/api/planning/schedule", json={"plant_id": "C351"})
    mock_schedule.assert_called_once_with("token", plant_id="C351")


def test_post_planning_schedule_returns_full_shape(mock_schedule):
    response = client.post("/api/planning/schedule", json={})
    data = response.json()
    for key in ("now_ms", "today_ms", "window_start_ms", "window_end_ms",
                "lines", "blocks", "backlog", "kpis"):
        assert key in data, f"Missing key: {key}"
    kpis = data["kpis"]
    for kpi_key in ("runningCount", "totalLines", "todaysQty", "backlogCount"):
        assert kpi_key in kpis, f"Missing kpi key: {kpi_key}"


def test_post_planning_schedule_block_shape(mock_schedule):
    response = client.post("/api/planning/schedule", json={})
    block = response.json()["blocks"][0]
    for key in ("id", "poId", "lineId", "start", "end", "kind", "label"):
        assert key in block, f"Missing block key: {key}"


def test_post_planning_schedule_empty_body(mock_schedule):
    response = client.post("/api/planning/schedule", json={})
    assert response.status_code == 200
