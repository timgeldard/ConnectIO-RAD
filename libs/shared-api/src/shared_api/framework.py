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
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, FastAPI, HTTPException

from shared_api.app_factory import create_api_app, register_spa_routes
from shared_api.databricks import DatabricksSqlRuntime, DatabricksSqlSettings
from shared_api.health import CheckWarehouseConfig, RunSql, databricks_sql_ready, health_payload, readiness_token_from_env
from shared_api.observability import configure_json_logging, configure_opentelemetry
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
        lifespan: Any | None = None,
        trust_forwarded_user: bool = False,
    ):
        self.app = create_api_app(
            title=title,
            version=version,
            latency_budgets_ms=latency_budgets_ms,
            latency_alert_callback=latency_alert_callback,
            lifespan=lifespan,
            trust_forwarded_user=trust_forwarded_user,
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


def create_rad_app(
    *,
    title: str,
    app_name: str,
    version: str = "0.1.0",
    static_dir: Path | None = None,
    check_warehouse_config: CheckWarehouseConfig | None = None,
    run_sql: RunSql | None = None,
    readiness_checks: list[ReadinessCheck] | None = None,
    latency_budgets_ms: dict[str, int] | None = None,
    latency_alert_callback: Callable[[str, int, int, int], Any] | None = None,
    debug_config: DebugConfigCallback | None = None,
    test_query_runner: TestQueryRunner | None = None,
    demo_mode: bool = False,
    enable_debug_endpoints: bool | None = None,
    trust_forwarded_user: bool = False,
    enable_json_logging: bool = True,
    enable_opentelemetry: bool | None = None,
    databricks_sql_settings: DatabricksSqlSettings | None = None,
    databricks_sql_runtime: DatabricksSqlRuntime | None = None,
    lifespan: Any | None = None,
) -> ConnectIoApp:
    """
    Create a production-standard ConnectIO-RAD FastAPI application.

    This is the preferred factory for new bounded contexts. It wires the
    shared FastAPI runtime, correlation IDs, safe exception masking, readiness
    probes, rate limiting hooks, same-origin protection, and optional
    Databricks SQL connectivity checks behind one stable entrypoint.

    Args:
        title: Human-readable API title.
        app_name: Stable app identifier used in logs and readiness metadata.
        version: API version string.
        static_dir: Optional built frontend directory for SPA serving.
        check_warehouse_config: Optional Databricks SQL config validator.
        run_sql: Optional async/sync SQL runner used by readiness checks.
        readiness_checks: Additional app-specific readiness checks.
        latency_budgets_ms: Per-path latency budgets.
        latency_alert_callback: Hook called when a request exceeds its budget.
        debug_config: Optional development debug endpoint callback.
        test_query_runner: Optional authenticated SQL smoke-test callback.
        demo_mode: If true, readiness stays green before live SQL is wired.
        enable_debug_endpoints: Override development-only debug endpoint gating.
        trust_forwarded_user: Trust Databricks forwarded identity headers.
        enable_json_logging: Configure root logging as JSON for Databricks logs.
        enable_opentelemetry: Instrument FastAPI when optional OTel packages exist.
        databricks_sql_settings: Optional Databricks SQL pool settings.
        databricks_sql_runtime: Optional runtime for pooled async SQLAlchemy.
        lifespan: Optional app-specific lifespan context manager.

    Returns:
        A configured :class:`ConnectIoApp`.
    """
    checks = list(readiness_checks or [])
    if enable_json_logging:
        configure_json_logging(app_name=app_name)

    sql_runtime = databricks_sql_runtime or DatabricksSqlRuntime(databricks_sql_settings)

    @asynccontextmanager
    async def _rad_lifespan(app: FastAPI):
        """Run shared Databricks runtime cleanup around caller lifespan."""
        app.state.databricks_sql = sql_runtime
        if lifespan is not None:
            async with lifespan(app):
                yield
        else:
            yield
        await sql_runtime.dispose()

    if check_warehouse_config is not None and run_sql is not None:
        async def _warehouse_ready() -> dict[str, Any]:
            return await databricks_sql_ready(
                check_warehouse_config=check_warehouse_config,
                run_sql=run_sql,
                endpoint_hint=f"{app_name}.ready",
            )

        checks.insert(0, _warehouse_ready)
    elif demo_mode:
        async def _demo_ready() -> dict[str, Any]:
            return {
                "status": "ready",
                "checks": {"demo_mode": "ok"},
                "app_name": app_name,
            }

        checks.insert(0, _demo_ready)

    rad_app = ConnectIoApp(
        title=title,
        version=version,
        static_dir=static_dir,
        latency_budgets_ms=latency_budgets_ms,
        latency_alert_callback=latency_alert_callback,
        readiness_checks=checks,
        debug_config=debug_config,
        test_query_runner=test_query_runner,
        enable_debug_endpoints=enable_debug_endpoints,
        lifespan=_rad_lifespan,
        trust_forwarded_user=trust_forwarded_user,
    )
    rad_app.app.state.databricks_sql = sql_runtime

    should_enable_otel = (
        os.environ.get("OTEL_ENABLED", "").strip().lower() in {"1", "true", "yes", "on"}
        if enable_opentelemetry is None
        else enable_opentelemetry
    )
    rad_app.app.state.opentelemetry_enabled = configure_opentelemetry(
        rad_app.app,
        service_name=app_name,
        enabled=should_enable_otel,
    )

    return rad_app
