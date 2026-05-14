"""ConnectIO Platform — unified FastAPI entry point.

Serves ConnectedQuality (at /cq), Trace (at /trace), EnvMon (at /envmon), SPC
(at /spc), ProcessOrderHistory (at /poh), and Warehouse360 (at /warehouse360)
from a single Databricks App process.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from starlette.staticfiles import StaticFiles

from shared_api import (
    create_api_app,
    databricks_sql_ready,
    health_payload,
    register_spa_routes,
)
from backend.routes.badges import router as badges_router
from backend.routes.dashboards.router import router as dashboards_router
from backend.routes.manifest import router as manifest_router
from backend.routes.session import router as session_router
from backend.utils import (
    PLATFORM_BACKEND_PACKAGES,
    _required_attr,
    discover_app_routers,
    get_missing_optional_artifacts,
)

logger = logging.getLogger(__name__)

# Core platform readiness dependencies (anchored to POH for now)
check_warehouse_config = _required_attr(
    "processorderhistory_backend.db", "check_warehouse_config"
)
run_sql_async = _required_attr("processorderhistory_backend.db", "run_sql_async")


# Register the backend packages that are installed into the deployed platform app.
ACTIVE_MODULES = PLATFORM_BACKEND_PACKAGES
logger.info("Configured active modules: %s", ACTIVE_MODULES)

# Static-asset roots.
_STATIC = Path(__file__).parent.parent / "static"
CQ_STATIC = _STATIC / "cq"
TRACE_STATIC = _STATIC / "trace"
ENVMON_STATIC = _STATIC / "envmon"
SPC_STATIC = _STATIC / "spc"
POH_STATIC = _STATIC / "poh"
W360_STATIC = _STATIC / "warehouse360"
HOME_STATIC = _STATIC / "home"

app = create_api_app(title="ConnectIO Platform API")

REQUIRED_ROUTE_METHODS: dict[str, set[str]] = {
    "/api/poh/orders": {"POST"},
    "/api/poh/pours/analytics": {"POST"},
    "/api/poh/me": {"GET"},
    "/api/platform/apps/manifest": {"GET"},
}


def _registered_methods_by_path() -> dict[str, list[str]]:
    """Return registered HTTP methods keyed by route path."""
    registered_methods: dict[str, list[str]] = {}
    for route in app.routes:
        path = getattr(route, "path", None)
        methods = getattr(route, "methods", None)
        if not path or methods is None:
            continue
        existing = set(registered_methods.get(path, []))
        existing.update(str(method) for method in methods)
        registered_methods[path] = sorted(existing)
    return dict(sorted(registered_methods.items()))


def _validate_required_routes() -> None:
    """Fail startup if required platform API routes were not mounted."""
    registered_methods = _registered_methods_by_path()
    missing: list[str] = []
    for path, required_methods in REQUIRED_ROUTE_METHODS.items():
        actual = set(registered_methods.get(path, []))
        missing_methods = sorted(required_methods - actual)
        if missing_methods:
            missing.append(f"{path} missing {','.join(missing_methods)}")

    if missing:
        raise RuntimeError(
            "Platform route contract incomplete: " + "; ".join(missing)
        )


def _build_artifact_status() -> dict[str, bool]:
    """Expose generated build artifact presence for deploy diagnostics."""
    return {
        "home_index": (HOME_STATIC / "index.html").is_file(),
        "home_module_manifest": (HOME_STATIC / "module-manifest.json").is_file(),
        "poh_index": (POH_STATIC / "index.html").is_file(),
    }


def _register_discovered_routers() -> None:
    """Discover and mount routers from all active modules."""
    routers = discover_app_routers(ACTIVE_MODULES)
    for router, prefix, tags in routers:
        kwargs: dict[str, Any] = {"prefix": prefix}
        if tags is not None:
            kwargs["tags"] = tags
        try:
            app.include_router(router, **kwargs)
        except Exception as exc:
            logger.warning(
                "Skipping invalid router %r (prefix=%s): %s",
                router,
                prefix,
                exc,
            )


_register_discovered_routers()
app.include_router(dashboards_router, prefix="/api/dashboards")
app.include_router(badges_router)
app.include_router(manifest_router)
app.include_router(session_router)
_validate_required_routes()


@app.get("/api/health", include_in_schema=False)
async def health():
    """Liveness probe."""
    return health_payload()


@app.get("/api/ready", include_in_schema=False)
async def ready():
    """Readiness probe."""
    return await databricks_sql_ready(
        check_warehouse_config=check_warehouse_config,
        run_sql=run_sql_async,
        endpoint_hint="platform.ready",
    )


@app.get("/api/health/routers", include_in_schema=False)
async def routers_health():
    """Inventory of registered API routes."""
    registered = sorted(
        route.path for route in app.routes if hasattr(route, "path")
    )
    return {
        "active_modules": ACTIVE_MODULES,
        "build_artifacts": _build_artifact_status(),
        "registered": registered,
        "registered_methods": _registered_methods_by_path(),
        "registered_count": len(registered),
        "required_route_methods": {
            path: sorted(methods)
            for path, methods in sorted(REQUIRED_ROUTE_METHODS.items())
        },
        "missing_optional": get_missing_optional_artifacts(),
    }


# Static mounts
_CORE_SLUGS = {"cq", "trace", "envmon", "spc", "poh", "warehouse360"}
for slug, directory in [
    ("cq", CQ_STATIC),
    ("trace", TRACE_STATIC),
    ("envmon", ENVMON_STATIC),
    ("spc", SPC_STATIC),
    ("poh", POH_STATIC),
    ("warehouse360", W360_STATIC),
]:
    if directory.exists():
        app.mount(f"/{slug}", StaticFiles(directory=str(directory), html=True), name=slug)

# Standalone demo apps — auto-discover any static/<slug>/index.html not already mounted above.
# Build script copies them from apps/platform/frontend/standalone/<slug>/.
for _dir in sorted(_STATIC.iterdir()):
    if (
        _dir.is_dir()
        and _dir.name not in _CORE_SLUGS
        and _dir.name != "home"
        and (_dir / "index.html").exists()
    ):
        app.mount(f"/{_dir.name}", StaticFiles(directory=str(_dir), html=True), name=_dir.name)
        logger.info("Mounted standalone app: /%s", _dir.name)

# Home SPA
register_spa_routes(
    app,
    static_dir_getter=lambda: HOME_STATIC,
    missing_frontend_payload={"status": "backend running", "frontend": "not built"},
)
