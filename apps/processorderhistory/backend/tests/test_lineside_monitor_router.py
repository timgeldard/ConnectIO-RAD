"""Router tests for POST /api/lineside-monitor/summary."""
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock

from processorderhistory_backend.main import app
import processorderhistory_backend.order_execution.router_lineside_monitor as lineside_router

client = TestClient(app)


def test_post_lineside_monitor_returns_summary(monkeypatch):
    monkeypatch.setattr(lineside_router, "check_warehouse_config", lambda: None)
    mock = AsyncMock(return_value={
        "kpis": {
            "lines_active": 1,
            "orders_running": 1,
            "blocked": 0,
            "awaiting_picks": 2,
            "lineside_materials": 3,
        },
        "lines": [],
        "activity": [],
        "lineside_stock": [],
        "data_available": True,
    })
    monkeypatch.setattr(lineside_router.order_queries, "get_lineside_monitor", mock)

    response = client.post("/api/lineside-monitor/summary", json={"plant_id": "CHV"})

    assert response.status_code == 200
    assert response.json()["kpis"]["lines_active"] == 1
    mock.assert_called_once_with("token", plant_id="CHV")
