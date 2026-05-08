"""Unit tests for the ConnectIoApp lifecycle.

The deferred SPA mount + RuntimeError guard is the load-bearing fix
that PR #29's framework migration was missing — eager mounting put
the catch-all ``/{full_path:path}`` route ahead of every API route
registered later, so production apps returned the SPA index.html
for ``/api/*`` calls. These tests pin the order-of-operations
contract so that regression cannot return silently.
"""
from __future__ import annotations

import os

import pytest
from fastapi import APIRouter
from fastapi.testclient import TestClient

from shared_api.framework import ConnectIoApp


@pytest.fixture(autouse=True)
def _readiness_token(monkeypatch):
    monkeypatch.setenv("DATABRICKS_READINESS_TOKEN", "test-token")
    yield


def _make_static_dir(tmp_path):
    """Create a minimal SPA build dir with a recognisable index.html."""
    static_dir = tmp_path / "dist"
    static_dir.mkdir()
    (static_dir / "index.html").write_text(
        "<html>spa-index</html>", encoding="utf-8"
    )
    return static_dir


def test_constructor_does_not_eagerly_mount_spa(tmp_path):
    """SPA mount must be deferred until ``mount_spa()`` is called."""
    static_dir = _make_static_dir(tmp_path)
    rad = ConnectIoApp(title="t", static_dir=static_dir)

    assert rad._spa_mounted is False, "SPA must not be mounted in __init__"

    client = TestClient(rad.app)
    # Without an explicit mount_spa(), the catch-all route does not exist,
    # so a request to ``/`` falls through to FastAPI's default 404.
    assert client.get("/").status_code == 404


def test_mount_spa_registers_catchall(tmp_path):
    """``mount_spa()`` wires up the catch-all that serves index.html."""
    static_dir = _make_static_dir(tmp_path)
    rad = ConnectIoApp(title="t", static_dir=static_dir)
    rad.mount_spa()

    response = TestClient(rad.app).get("/")

    assert response.status_code == 200
    assert b"spa-index" in response.content
    assert rad._spa_mounted is True


def test_mount_spa_is_idempotent(tmp_path):
    """Calling ``mount_spa()`` twice is a no-op the second time."""
    static_dir = _make_static_dir(tmp_path)
    rad = ConnectIoApp(title="t", static_dir=static_dir)
    rad.mount_spa()

    routes_after_first = list(rad.app.router.routes)
    rad.mount_spa()
    routes_after_second = list(rad.app.router.routes)

    assert routes_after_first == routes_after_second


def test_mount_spa_noop_without_static_dir():
    """When no ``static_dir`` is supplied, mount_spa just flips the flag."""
    rad = ConnectIoApp(title="t", static_dir=None)
    routes_before = list(rad.app.router.routes)
    rad.mount_spa()

    assert rad._spa_mounted is True
    assert list(rad.app.router.routes) == routes_before


def test_include_router_registers_before_mount(tmp_path):
    """Routers added BEFORE mount_spa survive and respond as expected."""
    static_dir = _make_static_dir(tmp_path)
    rad = ConnectIoApp(title="t", static_dir=static_dir)

    router = APIRouter()

    @router.get("/api/hello")
    async def hello():
        return {"hello": "world"}

    rad.include_router(router)
    rad.mount_spa()

    client = TestClient(rad.app)
    api_response = client.get("/api/hello")
    spa_response = client.get("/some-client-route")

    assert api_response.status_code == 200
    assert api_response.json() == {"hello": "world"}
    # And the SPA still serves index.html for unknown paths
    assert spa_response.status_code == 200
    assert b"spa-index" in spa_response.content


def test_include_router_after_mount_raises_runtimeerror(tmp_path):
    """Adding a router AFTER mount_spa is a programming error.

    The catch-all SPA route would shadow the new router silently;
    the guard converts that into a loud failure at registration time.
    """
    static_dir = _make_static_dir(tmp_path)
    rad = ConnectIoApp(title="t", static_dir=static_dir)
    rad.mount_spa()

    router = APIRouter()

    @router.get("/api/late")
    async def late():
        return {"too": "late"}

    with pytest.raises(RuntimeError) as exc_info:
        rad.include_router(router)

    assert "mount_spa" in str(exc_info.value)


def test_include_router_after_mount_raises_even_without_static_dir():
    """The guard fires regardless of static_dir — once mounted, no more routers."""
    rad = ConnectIoApp(title="t", static_dir=None)
    rad.mount_spa()

    with pytest.raises(RuntimeError):
        rad.include_router(APIRouter())


def test_fastapi_app_auto_mounts_on_first_access(tmp_path):
    """``rad.fastapi_app`` is the safety net for callers who forget mount_spa."""
    static_dir = _make_static_dir(tmp_path)
    rad = ConnectIoApp(title="t", static_dir=static_dir)

    assert rad._spa_mounted is False
    app = rad.fastapi_app  # auto-mount happens here
    assert rad._spa_mounted is True

    response = TestClient(app).get("/")
    assert response.status_code == 200
    assert b"spa-index" in response.content


def test_fastapi_app_after_explicit_mount_does_not_remount(tmp_path):
    """Reading the property after explicit mount must not re-register routes."""
    static_dir = _make_static_dir(tmp_path)
    rad = ConnectIoApp(title="t", static_dir=static_dir)
    rad.mount_spa()
    routes_after_mount = list(rad.app.router.routes)

    _ = rad.fastapi_app

    assert list(rad.app.router.routes) == routes_after_mount


def test_fastapi_app_auto_mount_blocks_subsequent_include_router(tmp_path):
    """The guard should fire even when SPA was mounted via the property."""
    static_dir = _make_static_dir(tmp_path)
    rad = ConnectIoApp(title="t", static_dir=static_dir)
    _ = rad.fastapi_app

    with pytest.raises(RuntimeError):
        rad.include_router(APIRouter())


def test_api_routes_take_precedence_over_spa_when_registered_first(tmp_path):
    """End-to-end: the deferred-mount design means /api/* never gets shadowed.

    This is the regression we are protecting against: with eager
    mounting, GET /api/health returned the SPA's index.html.
    """
    static_dir = _make_static_dir(tmp_path)
    rad = ConnectIoApp(title="t", static_dir=static_dir)

    router = APIRouter()

    @router.get("/api/probe")
    async def probe():
        return {"probe": "ok"}

    rad.include_router(router)
    app = rad.fastapi_app  # auto-mount

    client = TestClient(app)
    api_response = client.get("/api/probe")

    assert api_response.status_code == 200
    assert api_response.json() == {"probe": "ok"}
    # Sanity: the standard probe also still works through the same path.
    health_response = client.get("/api/health")
    assert health_response.status_code == 200
    assert health_response.json() == {"status": "ok"}
