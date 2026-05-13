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
    _required_attr,
    discover_active_modules,
    discover_app_routers,
    get_missing_optional_artifacts,
)

logger = logging.getLogger(__name__)

# Core platform readiness dependencies (anchored to POH for now)
check_warehouse_config = _required_attr(
    "processorderhistory_backend.db", "check_warehouse_config"
)
run_sql_async = _required_attr("processorderhistory_backend.db", "run_sql_async")


# Discover active manufacturing modules by scanning the apps/ directory.
ACTIVE_MODULES = discover_active_modules()
logger.info("Discovered active modules: %s", ACTIVE_MODULES)

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
        "registered": registered,
        "registered_count": len(registered),
        "missing_optional": get_missing_optional_artifacts(),
    }


# Static mounts
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

# Home SPA
register_spa_routes(
    app,
    static_dir_getter=lambda: HOME_STATIC,
    missing_frontend_payload={"status": "backend running", "frontend": "not built"},
)
