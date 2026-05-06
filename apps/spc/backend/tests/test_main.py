
from starlette.requests import Request
from fastapi import FastAPI
from fastapi.testclient import TestClient

import spc_backend.main as main_module
from spc_backend.main import app


client = TestClient(app)


def test_health_returns_200():
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_debug_hidden_in_production(monkeypatch):
    monkeypatch.setattr(main_module, "ENABLE_DEBUG_ENDPOINTS", False)

    response = client.get("/api/health/debug", headers={"x-forwarded-access-token": "token"})

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

    response = client.get("/api/test-query", headers={"x-forwarded-access-token": "token"})

    assert response.status_code == 404


def test_global_exception_handler_returns_safe_500():
    # To test the global exception handler, we use a fresh app to avoid polluting the shared one.
    from shared_api import safe_global_exception_response

    test_app = FastAPI()

    @test_app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        return await safe_global_exception_response(request, exc, logger_name="test-app")

    @test_app.post("/api/trigger-error-test")
    async def trigger_error():
        raise RuntimeError("secret details")
    
    local_client = TestClient(test_app, raise_server_exceptions=False)
    response = local_client.post("/api/trigger-error-test")
    
    assert response.status_code == 500
    body = response.json()
    assert "secret details" not in str(body)
    assert "error_id" in body
    assert body["detail"] == "Internal server error"
