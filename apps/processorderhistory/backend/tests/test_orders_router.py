"""Router tests for POST /api/orders."""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock

from backend.main import app
import backend.routers.orders as orders_router

client = TestClient(app)

_ORDER_ROW = {
    "process_order_id": "PO-001",
    "inspection_lot_id": "LOT-001",
    "material_id": "MAT-001",
    "material_name": "Test Product",
    "material_category": "Dairy",
    "plant_id": "P001",
    "status": "running",
    "start_ms": 1700000000000,
    "end_ms": 1700003600000,
    "duration_h": 1.0,
    "actual_qty": 250.5,
    "qty_uom": "KG",
}


@pytest.fixture
def mock_orders(monkeypatch):
    monkeypatch.setattr(orders_router, "resolve_token", lambda *_: "token")
    monkeypatch.setattr(orders_router, "check_warehouse_config", lambda: None)
    mock = AsyncMock(return_value=[_ORDER_ROW])
    monkeypatch.setattr(orders_router, "fetch_orders_list", mock)
    return mock


def test_post_orders_returns_200(mock_orders):
    response = client.post("/api/orders", json={})
    assert response.status_code == 200
    data = response.json()
    assert "orders" in data
    assert "total" in data
    assert data["total"] == 1
    assert data["orders"][0]["process_order_id"] == "PO-001"
    mock_orders.assert_called_once_with("token", plant_id=None, limit=2000)


def test_post_orders_total_matches_row_count(mock_orders):
    response = client.post("/api/orders", json={})
    data = response.json()
    assert data["total"] == len(data["orders"])


def test_post_orders_passes_plant_id(mock_orders):
    client.post("/api/orders", json={"plant_id": "P001"})
    mock_orders.assert_called_once_with("token", plant_id="P001", limit=2000)


def test_post_orders_passes_limit(mock_orders):
    client.post("/api/orders", json={"limit": 100})
    mock_orders.assert_called_once_with("token", plant_id=None, limit=100)


def test_post_orders_returns_empty_list(mock_orders):
    mock_orders.return_value = []
    response = client.post("/api/orders", json={})
    data = response.json()
    assert data["orders"] == []
    assert data["total"] == 0
