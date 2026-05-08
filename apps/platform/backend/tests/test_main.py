"""Tests for the platform shell — health, readiness, and router inventory."""

from fastapi.testclient import TestClient

from backend.main import app


def test_platform_health_returns_ok():
    """``/api/health`` is a liveness probe that does not depend on imports."""
    response = TestClient(app).get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_routers_health_lists_registered_routes():
    """``/api/health/routers`` reports the inventory of registered API routes."""
    response = TestClient(app).get("/api/health/routers")

    assert response.status_code == 200
    body = response.json()
    assert body["registered_count"] > 0
    assert isinstance(body["registered"], list)
    assert any(path.startswith("/api/cq") for path in body["registered"])
    assert any(path == "/api/batch-header" for path in body["registered"])
    assert any(path.startswith("/api/em") for path in body["registered"])
    assert any(path.startswith("/api/spc") for path in body["registered"])
    assert any(path.startswith("/api/wh") for path in body["registered"])
    assert "/api/wh/imwm/stock" in body["registered"]
    # Required-artifact failures abort startup, so by definition no required
    # artifacts can be missing here. Optional artifacts may still be empty.
    assert isinstance(body["missing_optional"], dict)
