from __future__ import annotations

from collections.abc import Callable
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse

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
    """
    Bootstrap a FastAPI application with standard ConnectIO-RAD defaults.
    
    Includes SameOriginMiddleware by default and optional SlowAPI configuration.
    
    Args:
        title: The application title.
        docs_url: The path to the Swagger UI (default /api/docs).
        redoc_url: Optional path to ReDoc documentation.
        limiter: Optional SlowAPI Limiter instance.
        rate_limit_exception: Optional exception type for rate limiting.
        rate_limit_handler: Optional handler for rate limit exceptions.
        slowapi_middleware: Optional SlowAPI middleware class.
        same_origin_middleware: Middleware to enforce same-origin (defaults to SameOriginMiddleware).
    """
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
    """
    Register catch-all routes to serve a Single Page Application (SPA).
    
    Routes:
      - GET /              -> serves index.html or fallback
      - GET /{full_path}   -> serves static assets or index.html (client-side routing)
    
    Args:
        app: The FastAPI application.
        static_dir_getter: A callable that returns the Path to the SPA's build directory.
        assets_path: The URL prefix for static assets (default /assets).
        missing_frontend_payload: JSON response if frontend files are missing.
    """
    fallback_payload = missing_frontend_payload or {"status": "backend running", "frontend": "not built"}

    def index_file(static_dir: Path) -> Path | None:
        index = static_dir / "index.html"
        return index if static_dir.exists() and index.is_file() else None

    def safe_static_file(static_dir: Path, requested_path: str) -> Path | None:
        if not static_dir.exists():
            return None
        root = static_dir.resolve()
        candidate = (root / requested_path.lstrip("/")).resolve()
        if not candidate.is_relative_to(root):
            return None
        return candidate if candidate.is_file() else None

    @app.get("/", include_in_schema=False)
    async def serve_index():
        index = index_file(static_dir_getter())
        if index is None:
            return fallback_payload
        return FileResponse(index, headers=NO_CACHE)

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        static_dir = static_dir_getter()
        candidate = safe_static_file(static_dir, full_path)
        asset_prefix = assets_path.strip("/")
        if candidate is None and asset_prefix and full_path.startswith(f"{asset_prefix}/"):
            candidate = safe_static_file(static_dir, f"assets/{full_path.removeprefix(f'{asset_prefix}/')}")
        if candidate is not None:
            return FileResponse(candidate)
        index = index_file(static_dir)
        if index is not None:
            return FileResponse(index, headers=NO_CACHE)
        raise HTTPException(status_code=404, detail="Frontend not built.")
