"""Router tests for GET /api/orders/{order_id}."""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock

from backend.main import app
import backend.routers.order_detail_router as detail_router

client = TestClient(app)

_DETAIL_PAYLOAD = {
    "order": {
        "process_order_id": "PO-001",
        "status": "running",
        "raw_status": "IN PROGRESS",
        "material_id": "MAT-001",
        "material_name": "Test Product",
        "material_category": "Dairy",
        "plant_id": "P001",
        "inspection_lot_id": "LOT-001",
        "batch_id": "B001",
        "supplier_batch_id": None,
        "manufacture_date_ms": 1700000000000,
        "expiry_date_ms": 1710000000000,
    },
    "time_summary": {"setup_s": 120.0, "mach_s": 3600.0, "clean_s": 300.0},
    "movement_summary": {"qty_issued_kg": 100.0, "qty_received_kg": None},
    "phases": [],
    "materials": [],
    "movements": [],
    "comments": [],
    "downtime": [],
    "equipment": [],
    "inspections": [],
    "usage_decision": None,
}


@pytest.fixture
def mock_detail(monkeypatch):
    monkeypatch.setattr(detail_router, "resolve_token", lambda *_: "token")
    monkeypatch.setattr(detail_router, "check_warehouse_config", lambda: None)
    mock = AsyncMock(return_value=_DETAIL_PAYLOAD)
    monkeypatch.setattr(detail_router, "fetch_order_detail", mock)
    return mock


@pytest.fixture
def mock_detail_not_found(monkeypatch):
    monkeypatch.setattr(detail_router, "resolve_token", lambda *_: "token")
    monkeypatch.setattr(detail_router, "check_warehouse_config", lambda: None)
    mock = AsyncMock(return_value=None)
    monkeypatch.setattr(detail_router, "fetch_order_detail", mock)
    return mock


def test_get_order_detail_returns_200(mock_detail):
    response = client.get("/api/orders/PO-001")
    assert response.status_code == 200
    data = response.json()
    assert data["order"]["process_order_id"] == "PO-001"
    assert data["order"]["status"] == "running"
    assert "phases" in data
    assert "inspections" in data
    mock_detail.assert_called_once_with("token", order_id="PO-001")


def test_get_order_detail_passes_decoded_id(mock_detail):
    """Starlette decodes %20 in path segments before handing to the handler."""
    client.get("/api/orders/PO%20001")
    args, kwargs = mock_detail.call_args
    assert kwargs["order_id"] == "PO 001"


def test_get_order_detail_returns_404_when_not_found(mock_detail_not_found):
    response = client.get("/api/orders/NOPE")
    assert response.status_code == 404
    assert "NOPE" in response.json()["detail"]


def test_get_order_detail_returns_full_shape(mock_detail):
    response = client.get("/api/orders/PO-001")
    data = response.json()
    for key in ("order", "time_summary", "movement_summary", "phases",
                "materials", "movements", "comments", "downtime",
                "equipment", "inspections", "usage_decision"):
        assert key in data, f"Missing key: {key}"
