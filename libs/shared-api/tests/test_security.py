from fastapi import FastAPI
from fastapi.testclient import TestClient

from shared_api.security import SameOriginMiddleware


def _make_app() -> FastAPI:
    app = FastAPI()
    app.add_middleware(SameOriginMiddleware)

    @app.get("/read")
    def read():
        return {"ok": True}

    @app.post("/write")
    def write():
        return {"ok": True}

    @app.delete("/delete")
    def delete():
        return {"ok": True}

    return app


def test_get_requests_never_blocked_regardless_of_origin():
    client = TestClient(_make_app())
    response = client.get("/read", headers={"Origin": "https://evil.example.com"})
    assert response.status_code == 200


def test_same_origin_post_allowed():
    client = TestClient(_make_app(), base_url="http://testserver")
    response = client.post("/write", headers={"Origin": "http://testserver"})
    assert response.status_code == 200


def test_cross_origin_post_blocked():
    client = TestClient(_make_app(), base_url="http://testserver")
    response = client.post("/write", headers={"Origin": "https://evil.example.com"})
    assert response.status_code == 403
    assert response.json() == {
        "detail": "Cross-origin mutation blocked",
        "origin": "evil.example.com",
    }


def test_cross_origin_delete_blocked():
    client = TestClient(_make_app(), base_url="http://testserver")
    response = client.delete("/delete", headers={"Origin": "https://evil.example.com"})
    assert response.status_code == 403


def test_missing_origin_and_referer_is_allowed_for_non_browser_clients():
    client = TestClient(_make_app(), base_url="http://testserver")
    response = client.post("/write")
    assert response.status_code == 200


def test_env_allowed_origins_override(monkeypatch):
    monkeypatch.setenv("APP_ALLOWED_ORIGINS", "https://trusted.example.com,https://also-trusted.com")
    client = TestClient(_make_app(), base_url="http://testserver")

    trusted = client.post("/write", headers={"Origin": "https://trusted.example.com"})
    blocked = client.post("/write", headers={"Origin": "https://evil.example.com"})

    assert trusted.status_code == 200
    assert blocked.status_code == 403


def test_legacy_spc_allowed_origins_still_supported(monkeypatch):
    monkeypatch.delenv("APP_ALLOWED_ORIGINS", raising=False)
    monkeypatch.setenv("SPC_ALLOWED_ORIGINS", "https://legacy.example.com")
    client = TestClient(_make_app(), base_url="http://testserver")

    response = client.post("/write", headers={"Origin": "https://legacy.example.com"})

    assert response.status_code == 200


def test_x_forwarded_host_chain_uses_first_hop_when_trusted(monkeypatch):
    monkeypatch.setenv("APP_TRUST_X_FORWARDED_HOST", "true")
    client = TestClient(_make_app(), base_url="http://internal.service.local")
    response = client.post(
        "/write",
        headers={
            "Origin": "https://spc-abc123.azure.databricksapps.com",
            "X-Forwarded-Host": "spc-abc123.azure.databricksapps.com, lb.internal",
        },
    )
    assert response.status_code == 200


def test_x_forwarded_host_is_not_trusted_by_default():
    client = TestClient(_make_app(), base_url="http://internal.service.local")
    response = client.post(
        "/write",
        headers={
            "Origin": "https://spc-abc123.azure.databricksapps.com",
            "X-Forwarded-Host": "spc-abc123.azure.databricksapps.com",
        },
    )
    assert response.status_code == 403


def test_origin_mismatching_both_host_and_forwarded_still_blocked(monkeypatch):
    monkeypatch.setenv("APP_TRUST_X_FORWARDED_HOST", "true")
    client = TestClient(_make_app(), base_url="http://internal.service.local")
    response = client.post(
        "/write",
        headers={
            "Origin": "https://evil.example.com",
            "X-Forwarded-Host": "spc-abc123.azure.databricksapps.com",
        },
    )
    assert response.status_code == 403


def test_referer_fallback_when_no_origin_header():
    client = TestClient(_make_app(), base_url="http://testserver")

    same = client.post("/write", headers={"Referer": "http://testserver/some/path"})
    cross = client.post("/write", headers={"Referer": "https://evil.example.com/"})

    assert same.status_code == 200
    assert cross.status_code == 403


def test_invalid_origin_header_is_blocked():
    client = TestClient(_make_app(), base_url="http://testserver")
    response = client.post("/write", headers={"Origin": "null"})
    assert response.status_code == 403
