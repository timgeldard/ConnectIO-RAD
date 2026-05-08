"""
ConnectIO-RAD Application Framework.

This module provides the high-level ConnectIoApp class which encapsulates
FastAPI setup, standard probes (health/ready), and SPA mounting to reduce
boilerplate across the monorepo applications.
"""
from __future__ import annotations

import os
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

        self._register_standard_routes()

        if self.static_dir:
            register_spa_routes(self.app, static_dir_getter=lambda: self.static_dir)

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
                    raise HTTPException(
                        status_code=503,
                        detail={
                            "status": "not_ready",
                            "reason": "internal_check_failed",
                            "message": str(exc),
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
        """Delegate router registration to the underlying FastAPI app."""
        self.app.include_router(router, **kwargs)

    @property
    def fastapi_app(self) -> FastAPI:
        """Expose the underlying FastAPI instance."""
        return self.app
