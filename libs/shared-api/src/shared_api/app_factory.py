"""
Application factory for ConnectIO-RAD FastAPI services.

This module provides a unified way to create FastAPI applications with
standardized middleware, exception handling, and security defaults.
"""
from __future__ import annotations

import logging
import os
from collections.abc import AsyncGenerator, Callable
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from starlette.requests import Request as StarletteRequest

from shared_api.errors import safe_global_exception_response
from shared_api.middleware import LatencyMiddleware, RequestContextMiddleware, SecurityHeadersMiddleware
from shared_api.rate_limit import RateLimitExceeded, RateLimitMiddleware, rate_limit_handler
from shared_api.security import SameOriginMiddleware
from shared_auth.identity import warn_if_jwks_unconfigured
from shared_db.errors import WarehouseNotConfiguredError


StaticDirGetter = Callable[[], Path]
logger = logging.getLogger(__name__)

NO_CACHE = {"Cache-Control": "no-store"}


_DEFAULT_ALLOW_METHODS = ["GET", "POST", "OPTIONS"]
_DEFAULT_ALLOW_HEADERS = [
    "Content-Type",
    "Authorization",
    "X-Forwarded-Access-Token",
    "X-Request-Id",
]


def create_api_app(
    *,
    title: str,
    version: str = "0.1.0",
    docs_url: str = "/api/docs",
    redoc_url: str | None = None,
    openapi_url: str | None = "/openapi.json",
    enable_docs: bool | None = None,
    lifespan: Any | None = None,
    latency_budgets_ms: dict[str, int] | None = None,
    default_latency_budget_ms: int = 10_000,
    latency_alert_callback: Callable[[str, int, int, int], Any] | None = None,
    allow_origins: list[str] | None = None,
    allow_methods: list[str] | None = None,
    allow_headers: list[str] | None = None,
    enable_rate_limit: bool = True,
    enable_security_headers: bool = True,
    trust_forwarded_user: bool = False,
    same_origin_middleware: type = SameOriginMiddleware,
) -> FastAPI:
    """
    Bootstrap a FastAPI application with standard ConnectIO-RAD defaults.

    Args:
        title: The title of the application.
        version: The version of the application.
        docs_url: The URL where Swagger UI will be served.
        redoc_url: The URL where ReDoc will be served.
        openapi_url: The URL where the OpenAPI schema will be served.
        enable_docs: Whether docs and OpenAPI routes should be enabled.
            Defaults to disabled when ``APP_ENV=production``.
        lifespan: Optional lifespan context manager for the FastAPI app.
        latency_budgets_ms: A mapping of paths to their latency budgets in milliseconds.
        default_latency_budget_ms: The default latency budget for paths not in latency_budgets_ms.
        latency_alert_callback: A callback triggered when a request exceeds its latency budget.
        allow_origins: A list of origins allowed for CORS. Defaults to [] if None.
        allow_methods: HTTP methods permitted in CORS preflight. Defaults to GET, POST, OPTIONS.
        allow_headers: Request headers permitted in CORS preflight. Defaults to a safe explicit list.
        enable_rate_limit: Whether to enable the built-in rate limiting middleware.
        enable_security_headers: Whether to attach standard browser security headers.
        trust_forwarded_user: Whether to trust the x-forwarded-preferred-username header for identity.
        same_origin_middleware: The middleware class to use for same-origin enforcement.

    Returns:
        A pre-configured FastAPI application instance.
    """
    @asynccontextmanager
    async def _lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
        """Run JWKS check then delegate to any caller-supplied lifespan."""
        warn_if_jwks_unconfigured()
        if lifespan is not None:
            async with lifespan(app):
                yield
        else:
            yield

    docs_enabled = (
        os.environ.get("APP_ENV", "").strip().lower() != "production"
        if enable_docs is None
        else enable_docs
    )

    app = FastAPI(
        title=title,
        version=version,
        docs_url=docs_url if docs_enabled else None,
        redoc_url=redoc_url if docs_enabled else None,
        openapi_url=openapi_url if docs_enabled else None,
        lifespan=_lifespan,
    )

    # 1. Global Exception Handlers
    @app.exception_handler(Exception)
    async def global_exception_handler(request: StarletteRequest, exc: Exception):
        return await safe_global_exception_response(request, exc, logger_name=title)

    @app.exception_handler(WarehouseNotConfiguredError)
    async def warehouse_not_configured_handler(request: StarletteRequest, exc: WarehouseNotConfiguredError):
        return JSONResponse(status_code=500, content={"detail": str(exc)})

    if enable_rate_limit:
        app.add_exception_handler(RateLimitExceeded, rate_limit_handler)

    # 2. Middleware Stack (Executed in reverse order of addition)
    
    # Rate Limiting
    if enable_rate_limit:
        app.add_middleware(RateLimitMiddleware)

    # Security: Same-Origin
    app.add_middleware(same_origin_middleware)

    if enable_security_headers:
        app.add_middleware(SecurityHeadersMiddleware)

    # Security: CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[] if allow_origins is None else allow_origins,
        allow_credentials=True,
        allow_methods=_DEFAULT_ALLOW_METHODS if allow_methods is None else allow_methods,
        allow_headers=_DEFAULT_ALLOW_HEADERS if allow_headers is None else allow_headers,
    )

    # Observability: Latency Monitoring
    app.add_middleware(
        LatencyMiddleware,
        latency_budgets_ms=latency_budgets_ms,
        default_latency_budget_ms=default_latency_budget_ms,
        alert_callback=latency_alert_callback,
    )

    # Observability: Request Context (request_id)
    app.add_middleware(RequestContextMiddleware, trust_forwarded_user=trust_forwarded_user)

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

    This utility mounts a series of routes that attempt to serve static files from
    a directory, falling back to index.html for unknown paths to support client-side
    routing.

    Args:
        app: The FastAPI application to register routes on.
        static_dir_getter: A callable that returns the Path to the static directory.
            This is a callable to allow for late resolution of the path.
        assets_path: The URL prefix for static assets.
        missing_frontend_payload: The JSON payload to return if the frontend is not built.
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
