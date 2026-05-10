"""
ConnectIO-RAD Application Framework.

This module provides the high-level ConnectIoApp class which encapsulates
FastAPI setup, standard probes (health/ready), and SPA mounting to reduce
boilerplate across the monorepo applications.
"""
from __future__ import annotations

import logging
import os
import uuid
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, FastAPI, HTTPException

from shared_api.app_factory import create_api_app, register_spa_routes
from shared_api.health import health_payload, readiness_token_from_env
from shared_auth import UserIdentity, require_user

ReadinessCheck = Callable[[], Awaitable[dict[str, Any]]]
DebugConfigCallback = Callable[[UserIdentity], Awaitable[dict[str, Any]]]
TestQueryRunner = Callable[[UserIdentity], Awaitable[dict[str, Any]]]
logger = logging.getLogger(__name__)


class ConnectIoApp:
    """
    Unified application wrapper for ConnectIO-RAD backend services.
    """

    def __init__(
        self,
        *,
        title: str,
        version: str = "0.1.0",
        static_dir: Path | None = None,
        latency_budgets_ms: dict[str, int] | None = None,
        latency_alert_callback: Callable[[str, int, int, int], Any] | None = None,
        readiness_checks: list[ReadinessCheck] | None = None,
        debug_config: DebugConfigCallback | None = None,
        test_query_runner: TestQueryRunner | None = None,
        enable_debug_endpoints: bool | None = None,
    ):
        self.app = create_api_app(
            title=title,
            version=version,
            latency_budgets_ms=latency_budgets_ms,
            latency_alert_callback=latency_alert_callback,
        )
        self.static_dir = static_dir
        self.readiness_checks = readiness_checks or []
        self.debug_config = debug_config
        self.test_query_runner = test_query_runner

        if enable_debug_endpoints is None:
            self.enable_debug_endpoints = os.environ.get("APP_ENV", "").strip().lower() == "development"
        else:
            self.enable_debug_endpoints = enable_debug_endpoints

        self._spa_mounted = False
        self._register_standard_routes()

        # SPA mounting is *deferred* — it must happen AFTER the caller's
        # `include_router` calls because `register_spa_routes` adds a
        # catch-all `/{full_path:path}` route that would otherwise shadow
        # every API route registered later. The caller must invoke
        # ``rad_app.mount_spa()`` once their routers are wired up. The
        # `fastapi_app` property will auto-mount on first access if
        # `static_dir` was provided and `mount_spa()` hasn't been called
        # explicitly, but apps should prefer the explicit form for clarity.

    def _register_standard_routes(self) -> None:
        """Mount standardized probes and debug endpoints."""

        @self.app.get("/api/health", include_in_schema=False)
        async def health():
            """Liveness probe."""
            return health_payload()

        @self.app.get("/api/ready", include_in_schema=False)
        async def ready():
            """Readiness probe that aggregates configured checks."""
            if not readiness_token_from_env():
                raise HTTPException(
                    status_code=503,
                    detail={
                        "status": "not_ready",
                        "reason": "readiness_token_missing",
                        "message": "DATABRICKS_READINESS_TOKEN environment variable is not set.",
                    },
                )

            aggregated_checks = {}
            # Base response structure
            response: dict[str, Any] = {"status": "ready"}

            for check in self.readiness_checks:
                try:
                    result = await check()
                    if isinstance(result, dict):
                        if "checks" in result:
                            aggregated_checks.update(result["checks"])
                        # If a check returns top-level fields (like SPC's schema_contract_version), merge them
                        for k, v in result.items():
                            if k not in {"status", "checks"}:
                                response[k] = v
                except HTTPException:
                    raise
                except Exception as exc:
                    error_id = str(uuid.uuid4())
                    check_name = getattr(check, "__name__", check.__class__.__name__)
                    logger.exception(
                        "readiness_check.failed error_id=%s check=%s",
                        error_id,
                        check_name,
                    )
                    raise HTTPException(
                        status_code=503,
                        detail={
                            "status": "not_ready",
                            "reason": "internal_check_failed",
                            "message": "A readiness check failed. See error_id for correlation.",
                            "error_id": error_id,
                        },
                    ) from exc

            if aggregated_checks:
                response["checks"] = aggregated_checks
            return response

        if self.debug_config:
            @self.app.get("/api/health/debug", include_in_schema=False)
            async def health_debug(user: UserIdentity = Depends(require_user)):
                """Detailed runtime config for development/debugging."""
                if not self.enable_debug_endpoints:
                    raise HTTPException(status_code=404, detail="Not found")
                return await self.debug_config(user)

        if self.test_query_runner:
            @self.app.get("/api/test-query", include_in_schema=False)
            async def test_query(user: UserIdentity = Depends(require_user)):
                """Ad-hoc warehouse query runner for debugging."""
                if not self.enable_debug_endpoints:
                    raise HTTPException(status_code=404, detail="Not found")
                return await self.test_query_runner(user)

    def include_router(self, router: APIRouter, **kwargs: Any) -> None:
        """Delegate router registration to the underlying FastAPI app.

        Callers must register all routers BEFORE invoking
        :meth:`mount_spa` (or accessing :attr:`fastapi_app`, which
        auto-mounts on first access). Adding a router after the SPA
        mount has the same shadowing problem the deferred-mount design
        is preventing.

        Args:
            router: The FastAPI ``APIRouter`` to register on the
                underlying app.
            **kwargs: Forwarded verbatim to ``FastAPI.include_router``
                (e.g. ``prefix``, ``tags``, ``dependencies``).

        Raises:
            RuntimeError: If called after the SPA has been mounted.
        """
        if self._spa_mounted:
            raise RuntimeError(
                "ConnectIoApp.include_router was called after mount_spa(); "
                "the SPA catch-all would shadow this router. Register all "
                "routers BEFORE calling mount_spa() or accessing fastapi_app."
            )
        self.app.include_router(router, **kwargs)

    def mount_spa(self) -> None:
        """Register SPA serving routes on the FastAPI app.

        Idempotent — safe to call multiple times. Must be called AFTER
        :meth:`include_router` invocations because
        :func:`register_spa_routes` registers a catch-all
        ``/{full_path:path}`` route that would otherwise shadow API
        routes. No-op when the constructor's ``static_dir`` was None.
        """
        if self._spa_mounted or not self.static_dir:
            self._spa_mounted = True
            return
        register_spa_routes(self.app, static_dir_getter=lambda: self.static_dir)
        self._spa_mounted = True

    @property
    def fastapi_app(self) -> FastAPI:
        """Expose the underlying FastAPI instance.

        Auto-invokes :meth:`mount_spa` on first access so apps that
        forget the explicit call still serve their SPA — at the cost of
        making the access order load-bearing. Apps should prefer
        ``rad_app.mount_spa()`` explicitly after all
        ``rad_app.include_router(...)`` calls, then read ``fastapi_app``
        once at the end.

        Returns:
            The configured ``FastAPI`` application instance, with the
            SPA catch-all already mounted (if ``static_dir`` was
            provided).
        """
        if not self._spa_mounted:
            self.mount_spa()
        return self.app
