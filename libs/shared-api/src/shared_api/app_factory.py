from __future__ import annotations

from collections.abc import Callable
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from shared_api.security import SameOriginMiddleware


StaticDirGetter = Callable[[], Path]

NO_CACHE = {"Cache-Control": "no-store"}


def create_api_app(
    *,
    title: str,
    docs_url: str = "/api/docs",
    redoc_url: str | None = None,
    limiter: Any | None = None,
    rate_limit_exception: type[Exception] | None = None,
    rate_limit_handler: Callable[..., Any] | None = None,
    slowapi_middleware: type | None = None,
    same_origin_middleware: type = SameOriginMiddleware,
) -> FastAPI:
    app = FastAPI(title=title, docs_url=docs_url, redoc_url=redoc_url)
    if limiter is not None:
        app.state.limiter = limiter
    if rate_limit_exception is not None and rate_limit_handler is not None:
        app.add_exception_handler(rate_limit_exception, rate_limit_handler)
    if slowapi_middleware is not None:
        app.add_middleware(slowapi_middleware)
    app.add_middleware(same_origin_middleware)
    return app


def register_spa_routes(
    app: FastAPI,
    *,
    static_dir_getter: StaticDirGetter,
    assets_path: str = "/assets",
    missing_frontend_payload: dict[str, str] | None = None,
) -> None:
    initial_static_dir = static_dir_getter()
    if (initial_static_dir / "assets").exists():
        app.mount(assets_path, StaticFiles(directory=initial_static_dir / "assets"), name="assets")

    fallback_payload = missing_frontend_payload or {"status": "backend running", "frontend": "not built"}

    @app.get("/", include_in_schema=False)
    async def serve_index():
        static_dir = static_dir_getter()
        if not static_dir.exists():
            return fallback_payload
        return FileResponse(static_dir / "index.html", headers=NO_CACHE)

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        static_dir = static_dir_getter()
        if static_dir.exists():
            candidate = static_dir / full_path
            if candidate.is_file():
                return FileResponse(candidate)
            return FileResponse(static_dir / "index.html", headers=NO_CACHE)
        raise HTTPException(status_code=404, detail="Frontend not built.")
