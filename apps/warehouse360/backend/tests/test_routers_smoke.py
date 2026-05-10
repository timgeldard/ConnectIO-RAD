import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock
from warehouse360_backend.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def mock_auth(monkeypatch):
    from shared_auth import require_proxy_user, UserIdentity
    app.dependency_overrides[require_proxy_user] = lambda: UserIdentity(user_id="test", raw_token="token")
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def mock_dals(monkeypatch):
    from warehouse360_backend.inventory_management import router_inbound
    from warehouse360_backend.order_fulfillment import router_process_orders
    from warehouse360_backend.order_fulfillment import router_deliveries
    from warehouse360_backend.inventory_management import router_inventory
    
    monkeypatch.setattr(router_inbound.inventory_queries, "list_inbound_receipts", AsyncMock(return_value=[]))
    monkeypatch.setattr(router_inbound.inventory_queries, "get_receipt_detail", AsyncMock(return_value={"receipt": {}, "items": []}))
    
    monkeypatch.setattr(router_process_orders.fulfillment_queries, "list_process_orders", AsyncMock(return_value=[]))
    monkeypatch.setattr(router_process_orders.fulfillment_queries, "get_process_order_detail", AsyncMock(return_value={"order": {}, "transfer_requirements": []}))
    
    monkeypatch.setattr(router_deliveries.fulfillment_queries, "list_deliveries", AsyncMock(return_value=[]))
    monkeypatch.setattr(router_deliveries.fulfillment_queries, "get_delivery_detail", AsyncMock(return_value={"delivery": {}, "transfer_orders": []}))
    
    monkeypatch.setattr(router_inventory.inventory_queries, "list_bin_stock", AsyncMock(return_value=[]))
    monkeypatch.setattr(router_inventory.inventory_queries, "list_bin_stock_summary", AsyncMock(return_value=[]))
    monkeypatch.setattr(router_inventory.inventory_queries, "list_lineside_stock", AsyncMock(return_value=[]))
    monkeypatch.setattr(router_inventory.inventory_queries, "list_near_expiry_batches", AsyncMock(return_value=[]))
    
    # Mock freshness and config checks
    monkeypatch.setattr(router_inbound, "attach_data_freshness", AsyncMock(side_effect=lambda data, *a, **k: data))
    monkeypatch.setattr(router_inbound, "check_warehouse_config", lambda: None)
    
    monkeypatch.setattr(router_process_orders, "attach_data_freshness", AsyncMock(side_effect=lambda data, *a, **k: data))
    monkeypatch.setattr(router_process_orders, "check_warehouse_config", lambda: None)
    
    monkeypatch.setattr(router_deliveries, "attach_data_freshness", AsyncMock(side_effect=lambda data, *a, **k: data))
    monkeypatch.setattr(router_deliveries, "check_warehouse_config", lambda: None)
    
    monkeypatch.setattr(router_inventory, "attach_data_freshness", AsyncMock(side_effect=lambda data, *a, **k: data))
    monkeypatch.setattr(router_inventory, "check_warehouse_config", lambda: None)


def test_inbound_router_smoke(mock_dals):
    assert client.get("/api/wh360/inbound").status_code == 200
    assert client.get("/api/wh360/inbound/4501").status_code == 200


def test_process_orders_router_smoke(mock_dals):
    assert client.get("/api/wh360/wh-cockpit").status_code == 200
    assert client.get("/api/wh360/wh-cockpit/1001").status_code == 200


def test_deliveries_router_smoke(mock_dals):
    assert client.get("/api/wh360/deliveries").status_code == 200
    assert client.get("/api/wh360/deliveries/8001").status_code == 200


def test_inventory_router_smoke(mock_dals):
    assert client.get("/api/wh360/inventory/bins").status_code == 200
    assert client.get("/api/wh360/inventory/bins/summary").status_code == 200
    assert client.get("/api/wh360/inventory/lineside").status_code == 200
    assert client.get("/api/wh360/inventory/near-expiry").status_code == 200
