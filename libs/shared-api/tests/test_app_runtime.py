import asyncio

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from starlette.requests import Request

from shared_api.app_factory import create_api_app, register_spa_routes
from shared_api.errors import safe_global_exception_response
from shared_api.health import databricks_sql_ready, health_payload


def test_create_api_app_registers_same_origin_middleware():
    app = create_api_app(title="Test API")

    @app.post("/api/mutate")
    async def mutate():
        return {"ok": True}

    client = TestClient(app)
    response = client.post("/api/mutate", headers={"Origin": "https://evil.example.com"})

    assert response.status_code == 403
    assert response.json()["detail"] == "Cross-origin mutation blocked"


def test_register_spa_routes_uses_dynamic_static_dir(tmp_path):
    app = FastAPI()
    missing_dir = tmp_path / "missing"
    static_dir = tmp_path / "dist"
    current = {"path": missing_dir}
    register_spa_routes(app, static_dir_getter=lambda: current["path"])
    client = TestClient(app)

    assert client.get("/").json() == {"status": "backend running", "frontend": "not built"}

    static_dir.mkdir()
    (static_dir / "index.html").write_text("<html>ok</html>", encoding="utf-8")
    current["path"] = static_dir

    response = client.get("/")
    assert response.status_code == 200
    assert b"ok" in response.content


def test_register_spa_routes_rejects_path_traversal(tmp_path):
    app = FastAPI()
    static_dir = tmp_path / "dist"
    static_dir.mkdir()
    (static_dir / "index.html").write_text("<html>ok</html>", encoding="utf-8")
    (tmp_path / "secret.txt").write_text("secret", encoding="utf-8")
    register_spa_routes(app, static_dir_getter=lambda: static_dir)
    client = TestClient(app)

    response = client.get("/../secret.txt")

    assert response.status_code == 200
    assert b"secret" not in response.content
    assert b"ok" in response.content


def test_register_spa_routes_handles_missing_index(tmp_path):
    app = FastAPI()
    static_dir = tmp_path / "dist"
    static_dir.mkdir()
    register_spa_routes(app, static_dir_getter=lambda: static_dir)
    client = TestClient(app)

    assert client.get("/").json() == {"status": "backend running", "frontend": "not built"}
    assert client.get("/dashboard").status_code == 404


def test_register_spa_routes_serves_dynamic_assets(tmp_path):
    app = FastAPI()
    missing_dir = tmp_path / "missing"
    static_dir = tmp_path / "dist"
    current = {"path": missing_dir}
    register_spa_routes(app, static_dir_getter=lambda: current["path"])
    client = TestClient(app)

    static_dir.mkdir()
    (static_dir / "index.html").write_text("<html>ok</html>", encoding="utf-8")
    assets = static_dir / "assets"
    assets.mkdir()
    (assets / "app.js").write_text("console.log('ok')", encoding="utf-8")
    current["path"] = static_dir

    response = client.get("/assets/app.js")

    assert response.status_code == 200
    assert b"console.log" in response.content


def test_health_payload():
    assert health_payload() == {"status": "ok"}


def test_databricks_sql_ready_requires_token(monkeypatch):
    monkeypatch.delenv("DATABRICKS_READINESS_TOKEN", raising=False)

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(databricks_sql_ready(check_warehouse_config=lambda: None, run_sql=lambda *_: []))

    assert exc_info.value.status_code == 503
    assert exc_info.value.detail["reason"] == "readiness_token_missing"


def test_databricks_sql_ready_supports_async_runner(monkeypatch):
    monkeypatch.setenv("DATABRICKS_READINESS_TOKEN", "token")

    async def run_sql(token: str, query: str):
        return [{"ok": 1, "token": token, "query": query}]

    payload = asyncio.run(
        databricks_sql_ready(
            check_warehouse_config=lambda: None,
            run_sql=run_sql,
            include_sample_result=True,
        )
    )

    assert payload["status"] == "ready"
    assert payload["checks"]["sql_warehouse"] == "ok"
    assert payload["sample_result"]["ok"] == 1


def test_databricks_sql_ready_skips_endpoint_hint_when_runner_does_not_accept_it(monkeypatch):
    monkeypatch.setenv("DATABRICKS_READINESS_TOKEN", "token")

    async def run_sql(token: str, query: str):
        return [{"ok": 1, "token": token, "query": query}]

    payload = asyncio.run(
        databricks_sql_ready(
            check_warehouse_config=lambda: None,
            run_sql=run_sql,
            endpoint_hint="ready.check",
        )
    )

    assert payload["status"] == "ready"


def test_databricks_sql_ready_passes_endpoint_hint_when_supported(monkeypatch):
    monkeypatch.setenv("DATABRICKS_READINESS_TOKEN", "token")
    seen = {}

    async def run_sql(token: str, query: str, *, endpoint_hint: str):
        seen["endpoint_hint"] = endpoint_hint
        return [{"ok": 1, "token": token, "query": query}]

    asyncio.run(
        databricks_sql_ready(
            check_warehouse_config=lambda: None,
            run_sql=run_sql,
            endpoint_hint="ready.check",
        )
    )

    assert seen["endpoint_hint"] == "ready.check"


def test_safe_global_exception_response_hides_details():
    request = Request({"type": "http", "method": "GET", "path": "/api/test", "headers": []})

    response = asyncio.run(safe_global_exception_response(request, RuntimeError("secret"), logger_name=__name__))

    assert response.status_code == 500
    assert b"secret" not in response.body
    assert b"error_id" in response.body


def test_safe_global_exception_response_preserves_http_exception_headers():
    request = Request({"type": "http", "method": "GET", "path": "/api/test", "headers": []})
    exc = HTTPException(status_code=429, detail="slow down", headers={"Retry-After": "10"})

    response = asyncio.run(safe_global_exception_response(request, exc, logger_name=__name__))

    assert response.status_code == 429
    assert response.headers["retry-after"] == "10"
