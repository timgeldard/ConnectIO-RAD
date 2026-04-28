import asyncio
import json

from starlette.requests import Request
from fastapi import FastAPI
from fastapi.testclient import TestClient

import backend.main as main_module
from backend.main import app


client = TestClient(app)


def test_health_returns_200():
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_debug_hidden_in_production(monkeypatch):
    monkeypatch.setattr(main_module, "ENABLE_DEBUG_ENDPOINTS", False)

    response = client.get("/api/health/debug")

    assert response.status_code == 404


def test_health_debug_visible_in_development(monkeypatch):
    monkeypatch.setattr(main_module, "ENABLE_DEBUG_ENDPOINTS", True)

    # Pass the token via header to satisfy the manual resolve_token call
    response = client.get("/api/health/debug", headers={"x-forwarded-access-token": "token"})

    assert response.status_code == 200
    body = response.json()
    assert "databricks_host" in body
    assert "warehouse_http_path" in body
    assert "trace_catalog" in body
    assert "trace_schema" in body
    assert "static_dir_exists" in body


def test_test_query_hidden_in_production(monkeypatch):
    monkeypatch.setattr(main_module, "ENABLE_DEBUG_ENDPOINTS", False)

    response = client.get("/api/test-query")

    assert response.status_code == 404


def test_global_exception_handler_returns_safe_500():
    # To test the global exception handler, we need a route that is NOT caught by SPA fallback.
    # We also need to tell TestClient NOT to raise server exceptions.
    
    local_client = TestClient(app, raise_server_exceptions=False)
    
    @app.post("/api/trigger-error-test")
    async def trigger_error():
        raise RuntimeError("secret details")
    
    response = local_client.post("/api/trigger-error-test")
    
    assert response.status_code == 500
    body = response.json()
    assert "secret details" not in str(body)
    assert "error_id" in body
    assert body["detail"] == "Internal server error"
