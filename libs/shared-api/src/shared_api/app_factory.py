from __future__ import annotations

import logging
from collections.abc import Callable
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from starlette.requests import Request as StarletteRequest

from shared_api.errors import safe_global_exception_response
from shared_api.middleware import LatencyMiddleware, RequestContextMiddleware
from shared_api.rate_limit import RateLimitExceeded, RateLimitMiddleware, rate_limit_handler
from shared_api.security import SameOriginMiddleware


StaticDirGetter = Callable[[], Path]
logger = logging.getLogger(__name__)

NO_CACHE = {"Cache-Control": "no-store"}


def create_api_app(
    *,
    title: str,
    version: str = "0.1.0",
    docs_url: str = "/api/docs",
    redoc_url: str | None = None,
    lifespan: Any | None = None,
    latency_budgets_ms: dict[str, int] | None = None,
    latency_alert_callback: Callable[[str, int, int, int], Any] | None = None,
    allow_origins: list[str] | None = None,
    enable_rate_limit: bool = True,
    same_origin_middleware: type = SameOriginMiddleware,
) -> FastAPI:
    """
    Bootstrap a FastAPI application with standard ConnectIO-RAD defaults.
    """
    app = FastAPI(
        title=title,
        version=version,
        docs_url=docs_url,
        redoc_url=redoc_url,
        lifespan=lifespan,
    )

    # 1. Global Exception Handlers
    @app.exception_handler(Exception)
    async def global_exception_handler(request: StarletteRequest, exc: Exception):
        return await safe_global_exception_response(request, exc, logger_name=title)

    if enable_rate_limit:
        app.add_exception_handler(RateLimitExceeded, rate_limit_handler)

    # 2. Middleware Stack (Executed in reverse order of addition)
    
    # Rate Limiting
    if enable_rate_limit:
        app.add_middleware(RateLimitMiddleware)

    # Security: Same-Origin
    app.add_middleware(same_origin_middleware)

    # Security: CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allow_origins or ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Observability: Latency Monitoring
    app.add_middleware(
        LatencyMiddleware,
        latency_budgets_ms=latency_budgets_ms,
        alert_callback=latency_alert_callback,
    )

    # Observability: Request Context (request_id)
    app.add_middleware(RequestContextMiddleware)

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
