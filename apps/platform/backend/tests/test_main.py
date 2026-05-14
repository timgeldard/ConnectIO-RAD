"""Tests for the platform shell — health, readiness, and router inventory."""

import asyncio
from fastapi.testclient import TestClient

from backend import main
from backend.main import REQUIRED_ROUTE_METHODS, app


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
    assert "processorderhistory_backend" in body["active_modules"]
    assert body["required_route_methods"] == {
        path: sorted(methods)
        for path, methods in sorted(REQUIRED_ROUTE_METHODS.items())
    }
    assert isinstance(body["build_artifacts"], dict)
    assert isinstance(body["registered"], list)
    assert any(path.startswith("/api/cq") for path in body["registered"])
    assert any(path == "/api/batch-header" for path in body["registered"])
    assert any(path.startswith("/api/em") for path in body["registered"])
    assert any(path.startswith("/api/spc") for path in body["registered"])
    assert "/api/plants" in body["registered"]
    assert "/api/poh/plants" in body["registered"]
    assert any(path.startswith("/api/wh360") for path in body["registered"])
    assert "/api/wh360/imwm/stock" in body["registered"]
    assert "/api/wh/imwm/stock" not in body["registered"]
    assert "POST" in body["registered_methods"]["/api/poh/orders"]
    assert "POST" in body["registered_methods"]["/api/poh/pours/analytics"]
    assert "GET" in body["registered_methods"]["/api/platform/apps/manifest"]
    # Required-artifact failures abort startup, so by definition no required
    # artifacts can be missing here. Optional artifacts may still be empty.
    assert isinstance(body["missing_optional"], dict)


def test_ready_preserves_upstream_failure_status(monkeypatch):
    """Backend degradation must not hide a more severe SQL readiness status."""

    async def fake_ready(**_kwargs):
        return {"status": "error", "checks": {"sql_warehouse": "failed"}}

    monkeypatch.setattr(main, "databricks_sql_ready", fake_ready)
    monkeypatch.setattr(
        main,
        "get_missing_optional_artifacts",
        lambda: {next(iter(main.REQUIRED_PLATFORM_ROUTER_PACKAGES)): "missing"},
    )

    body = asyncio.run(main.ready())

    assert body["status"] == "error"
    assert "backends" in body["checks"]
