"""Tests for dynamic platform app registration endpoints."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.routes.manifest import router


def _client() -> TestClient:
    """Build a minimal app for manifest route tests."""
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


def test_platform_manifest_endpoint_serves_generated_modules():
    """The shell manifest API exposes generated module registrations."""
    response = _client().get("/api/platform/apps/manifest")

    assert response.status_code == 200
    body = response.json()
    assert body["version"] >= 1
    assert body["featureFlags"]["template.enabled"] is True
    template = next(module for module in body["modules"] if module["moduleId"] == "template")
    assert template["route"] == {"kind": "local", "path": "/template/"}
    assert template["category"] == "demo"


def test_platform_feature_flags_can_be_overridden(monkeypatch):
    """Deployment-time env vars can disable generated app registrations."""
    monkeypatch.setenv("PLATFORM_FEATURE_TEMPLATE_ENABLED", "false")

    response = _client().get("/api/platform/apps/feature-flags")

    assert response.status_code == 200
    assert response.json()["template.enabled"] is False


def test_platform_status_endpoint_reports_registered_modules():
    """Status payload is keyed by module id for dashboard badges."""
    response = _client().get("/api/platform/apps/status")

    assert response.status_code == 200
    template = response.json()["template"]
    assert template["badge"] == "Demo"
    assert template["status"] == "degraded"
