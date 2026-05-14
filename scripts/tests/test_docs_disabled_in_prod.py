"""Governance tests for production API documentation exposure."""

from fastapi.testclient import TestClient

from shared_api.app_factory import create_api_app


def test_docs_disabled_in_prod(monkeypatch):
    """Production app factories must not expose docs or OpenAPI by default."""
    monkeypatch.setenv("APP_ENV", "production")
    app = create_api_app(title="Production API")
    client = TestClient(app)

    assert client.get("/api/docs").status_code == 404
    assert client.get("/openapi.json").status_code == 404


def test_docs_can_be_enabled_explicitly_in_prod(monkeypatch):
    """Local diagnostics can opt back into docs with an explicit flag."""
    monkeypatch.setenv("APP_ENV", "production")
    app = create_api_app(title="Diagnostic API", enable_docs=True)
    client = TestClient(app)

    assert client.get("/api/docs").status_code == 200
    assert client.get("/openapi.json").status_code == 200
