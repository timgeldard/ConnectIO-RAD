"""Router tests for POST /api/pours/analytics."""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock

from backend.main import app
import backend.routers.pours_router as pours_router

client = TestClient(app)

_ANALYTICS_PAYLOAD = {
    "now_ms": 1700000000000,
    "planned_24h": 42,
    "lines": ["MIX-04", "SPD-02"],
    "events_24h": [
        {
            "material_name": "Whey Protein",
            "quantity": 250.0,
            "uom": "KG",
            "source_area": "STOR-01",
            "operator": "M.BRENNAN",
            "ts_ms": 1699913600000,
            "utc_hour": 10,
            "shift": "A",
            "line_id": "MIX-04",
        }
    ],
    "daily30d": {
        "ALL": [{"date": 1697328000000, "actual": 15, "target": None, "planned": None}],
        "MIX-04": [{"date": 1697328000000, "actual": 8, "target": None, "planned": None}],
    },
    "hourly24h": {
        "ALL": [{"hour": 1699910400000, "actual": 3, "target": None}],
        "MIX-04": [{"hour": 1699910400000, "actual": 3, "target": None}],
    },
}


@pytest.fixture
def mock_analytics(monkeypatch):
    monkeypatch.setattr(pours_router, "resolve_token", lambda *_: "token")
    monkeypatch.setattr(pours_router, "check_warehouse_config", lambda: None)
    mock = AsyncMock(return_value=_ANALYTICS_PAYLOAD)
    monkeypatch.setattr(pours_router, "fetch_pours_analytics", mock)
    return mock


def test_post_pours_analytics_returns_200(mock_analytics):
    response = client.post("/api/pours/analytics", json={})
    assert response.status_code == 200
    data = response.json()
    assert data["planned_24h"] == 42
    assert "lines" in data
    assert "events_24h" in data
    assert "daily30d" in data
    assert "hourly24h" in data
    assert "now_ms" in data
    mock_analytics.assert_called_once_with("token", plant_id=None)


def test_post_pours_analytics_passes_plant_id(mock_analytics):
    client.post("/api/pours/analytics", json={"plant_id": "P001"})
    mock_analytics.assert_called_once_with("token", plant_id="P001")


def test_post_pours_analytics_returns_full_shape(mock_analytics):
    response = client.post("/api/pours/analytics", json={})
    data = response.json()
    for key in ("now_ms", "planned_24h", "lines", "events_24h", "daily30d", "hourly24h"):
        assert key in data, f"Missing key: {key}"
    assert "ALL" in data["daily30d"]
    assert "ALL" in data["hourly24h"]
