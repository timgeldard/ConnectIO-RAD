"""Router-level tests for the IMWM (IM vs WM) inventory management endpoints.

Covers the HTTP layer: routing, response shape, and plant-scope resolution
via the two accepted query parameters (plant vs plant_id).
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient
from shared_auth import UserIdentity, require_proxy_user

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
    monkeypatch.setattr(imwm_router, "check_warehouse_config", lambda: None)
    monkeypatch.setattr(
        imwm_router.inventory_queries, "list_imwm_stock",
        AsyncMock(return_value=[{"plant_id": "IE01", "mismatch_kind": "match"}]),
    )
    monkeypatch.setattr(
        imwm_router.inventory_queries, "list_imwm_movements",
        AsyncMock(return_value=[{"plant_id": "IE01", "movement_type": "GR"}]),
    )
    monkeypatch.setattr(
        imwm_router.inventory_queries, "list_imwm_exceptions",
        AsyncMock(return_value=[{"plant_id": "IE01", "exception_type": "NEGATIVE_WM_QUANT"}]),
    )
    monkeypatch.setattr(
        imwm_router.inventory_queries, "list_imwm_aging",
        AsyncMock(return_value=[{"plant_id": "IE01", "age_bucket": "0-30d"}]),
    )
    monkeypatch.setattr(
        "warehouse360_backend.utils.db.attach_data_freshness",
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

    async def capture(*args, plant_id=None, **kwargs):
        captured["plant_id"] = plant_id
        return []

    monkeypatch.setattr(imwm_router.inventory_queries, "list_imwm_stock", capture)
    client.get("/api/wh360/imwm/stock?plant=IE01")
    assert captured.get("plant_id") == "IE01"


def test_imwm_stock_plant_wins_over_plant_id(mock_imwm_queries, monkeypatch):
    captured = {}

    async def capture(*args, plant_id=None, **kwargs):
        captured["plant_id"] = plant_id
        return []

    monkeypatch.setattr(imwm_router.inventory_queries, "list_imwm_stock", capture)
    client.get("/api/wh360/imwm/stock?plant=IE01&plant_id=DE01")
    assert captured.get("plant_id") == "IE01"


# ---------------------------------------------------------------------------
# GET /api/wh360/imwm/movements
# ---------------------------------------------------------------------------

def test_imwm_movements_returns_200_with_movements_key(mock_imwm_queries):
    response = client.get("/api/wh360/imwm/movements")
    assert response.status_code == 200
    assert "movements" in response.json()


def test_imwm_movements_plant_id_fallback(mock_imwm_queries, monkeypatch):
    captured = {}

    async def capture(*args, plant_id=None, **kwargs):
        captured["plant_id"] = plant_id
        return []

    monkeypatch.setattr(imwm_router.inventory_queries, "list_imwm_movements", capture)
    client.get("/api/wh360/imwm/movements?plant_id=DE01")
    assert captured.get("plant_id") == "DE01"


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
    assert imwm_router._resolve_plant_scope("IE01", "DE01") == "IE01"


def test_resolve_plant_scope_falls_back_to_plant_id():
    assert imwm_router._resolve_plant_scope(None, "DE01") == "DE01"
    assert imwm_router._resolve_plant_scope("", "DE01") == "DE01"


def test_resolve_plant_scope_strips_whitespace():
    assert imwm_router._resolve_plant_scope(" IE01 ", None) == "IE01"


def test_resolve_plant_scope_returns_none_when_both_empty():
    assert imwm_router._resolve_plant_scope(None, None) is None
    assert imwm_router._resolve_plant_scope("  ", "  ") is None
