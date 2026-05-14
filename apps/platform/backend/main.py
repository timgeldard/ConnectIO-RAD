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
    REQUIRED_PLATFORM_ROUTER_PACKAGES,
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


@app.get("/api/health", include_in_schema=False)
async def health():
    """Liveness probe."""
    return health_payload()


@app.get("/api/ready", include_in_schema=False)
async def ready():
    """Readiness probe — reports SQL connectivity and per-backend module status."""
    result = await databricks_sql_ready(
        check_warehouse_config=check_warehouse_config,
        run_sql=run_sql_async,
        endpoint_hint="platform.ready",
    )
    missing = get_missing_optional_artifacts()
    backend_checks: dict[str, str] = {}
    has_required_degraded = False
    for pkg in PLATFORM_BACKEND_PACKAGES:
        if pkg in missing:
            backend_checks[pkg] = f"degraded: {missing[pkg]}"
            if pkg in REQUIRED_PLATFORM_ROUTER_PACKAGES:
                has_required_degraded = True
        else:
            backend_checks[pkg] = "ok"
    result.setdefault("checks", {})["backends"] = backend_checks
    if has_required_degraded:
        result["status"] = "degraded"
    return result


@app.get("/api/health/routers", include_in_schema=False)
async def routers_health():
    """Inventory of registered API routes."""
    registered = sorted(
        route.path for route in app.routes if hasattr(route, "path")
    )
    registered_methods: dict[str, list[str]] = {}
    for route in app.routes:
        path = getattr(route, "path", None)
        methods = getattr(route, "methods", None)
        if not path or methods is None:
            continue
        existing = set(registered_methods.get(path, []))
        existing.update(str(method) for method in methods)
        registered_methods[path] = sorted(existing)
    return {
        "active_modules": ACTIVE_MODULES,
        "registered": registered,
        "registered_methods": dict(sorted(registered_methods.items())),
        "registered_count": len(registered),
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
