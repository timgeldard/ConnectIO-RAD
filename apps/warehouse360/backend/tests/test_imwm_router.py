"""Router-level tests for the IMWM (IM vs WM) inventory management endpoints.

Covers the HTTP layer: routing, response shape, and plant-scope resolution
via the two accepted query parameters (plant vs plant_id).
"""
from __future__ import annotations

from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient
from shared_auth import UserIdentity, require_proxy_user
from shared_manufacturing import test_data

from warehouse360_backend.main import app
import warehouse360_backend.inventory_management.router_imwm as imwm_router

client = TestClient(app)

FAKE_USER = UserIdentity(user_id="test-user", raw_token="fake-token")


@pytest.fixture(autouse=True)
def mock_auth(monkeypatch):
    """Override auth dependency for all tests in this module."""
    app.dependency_overrides[require_proxy_user] = lambda: FAKE_USER
    yield
    app.dependency_overrides.pop(require_proxy_user, None)


@pytest.fixture
def mock_imwm_queries(monkeypatch):
    """Stub all application-layer queries and warehouse config check."""
    plant = test_data.PLANTS[0]
    monkeypatch.setattr(imwm_router, "check_warehouse_config", lambda: None)
    monkeypatch.setattr(
        imwm_router.inventory_queries, "list_imwm_stock",
        AsyncMock(return_value=[{"plant_id": plant, "mismatch_kind": "match"}]),
    )
    monkeypatch.setattr(
        imwm_router.inventory_queries, "list_imwm_movements",
        AsyncMock(return_value=[{"plant_id": plant, "movement_type": "101"}]),
    )
    monkeypatch.setattr(
        imwm_router.inventory_queries, "list_imwm_exceptions",
        AsyncMock(return_value=[{"plant_id": plant, "exception_type": "NEGATIVE_WM_QUANT"}]),
    )
    monkeypatch.setattr(
        imwm_router.inventory_queries, "list_imwm_aging",
        AsyncMock(return_value=[{"plant_id": plant, "age_bucket": "0-30d"}]),
    )
    monkeypatch.setattr(
        imwm_router,
        "attach_data_freshness",
        AsyncMock(side_effect=lambda data, *a, **kw: data),
    )


# ---------------------------------------------------------------------------
# GET /api/wh360/imwm/stock
# ---------------------------------------------------------------------------

def test_imwm_stock_returns_200_with_stock_key(mock_imwm_queries):
    response = client.get("/api/wh360/imwm/stock")
    assert response.status_code == 200
    assert "stock" in response.json()
    assert response.json()["stock"][0]["mismatch_kind"] == "match"


def test_imwm_stock_passes_plant_param(mock_imwm_queries, monkeypatch):
    captured = {}
    plant = test_data.PLANTS[0]

    async def capture(*args, plant_id=None, **kwargs):
        captured["plant_id"] = plant_id
        return []

    monkeypatch.setattr(imwm_router.inventory_queries, "list_imwm_stock", capture)
    client.get(f"/api/wh360/imwm/stock?plant={plant}")
    assert captured.get("plant_id") == plant


def test_imwm_stock_plant_wins_over_plant_id(mock_imwm_queries, monkeypatch):
    captured = {}
    plant1 = test_data.PLANTS[0]
    plant2 = test_data.PLANTS[1]

    async def capture(*args, plant_id=None, **kwargs):
        captured["plant_id"] = plant_id
        return []

    monkeypatch.setattr(imwm_router.inventory_queries, "list_imwm_stock", capture)
    client.get(f"/api/wh360/imwm/stock?plant={plant1}&plant_id={plant2}")
    assert captured.get("plant_id") == plant1


# ---------------------------------------------------------------------------
# GET /api/wh360/imwm/movements
# ---------------------------------------------------------------------------

def test_imwm_movements_returns_200_with_movements_key(mock_imwm_queries):
    response = client.get("/api/wh360/imwm/movements")
    assert response.status_code == 200
    assert "movements" in response.json()


def test_imwm_movements_plant_id_fallback(mock_imwm_queries, monkeypatch):
    captured = {}
    plant = test_data.PLANTS[1]

    async def capture(*args, plant_id=None, **kwargs):
        captured["plant_id"] = plant_id
        return []

    monkeypatch.setattr(imwm_router.inventory_queries, "list_imwm_movements", capture)
    client.get(f"/api/wh360/imwm/movements?plant_id={plant}")
    assert captured.get("plant_id") == plant


# ---------------------------------------------------------------------------
# GET /api/wh360/imwm/exceptions
# ---------------------------------------------------------------------------

def test_imwm_exceptions_returns_200_with_exceptions_key(mock_imwm_queries):
    response = client.get("/api/wh360/imwm/exceptions")
    assert response.status_code == 200
    assert "exceptions" in response.json()


# ---------------------------------------------------------------------------
# GET /api/wh360/imwm/analytics/aging
# ---------------------------------------------------------------------------

def test_imwm_aging_returns_200_with_aging_key(mock_imwm_queries):
    response = client.get("/api/wh360/imwm/analytics/aging")
    assert response.status_code == 200
    assert "aging" in response.json()


# ---------------------------------------------------------------------------
# _resolve_plant_scope unit tests
# ---------------------------------------------------------------------------

def test_resolve_plant_scope_primary_wins():
    plant1 = test_data.PLANTS[0]
    plant2 = test_data.PLANTS[1]
    assert imwm_router._resolve_plant_scope(plant1, plant2) == plant1


def test_resolve_plant_scope_falls_back_to_plant_id():
    plant = test_data.PLANTS[1]
    assert imwm_router._resolve_plant_scope(None, plant) == plant
    assert imwm_router._resolve_plant_scope("", plant) == plant


def test_resolve_plant_scope_strips_whitespace():
    plant = test_data.PLANTS[0]
    assert imwm_router._resolve_plant_scope(f" {plant} ", None) == plant


def test_resolve_plant_scope_returns_none_when_both_empty():
    assert imwm_router._resolve_plant_scope(None, None) is None
    assert imwm_router._resolve_plant_scope("  ", "  ") is None
