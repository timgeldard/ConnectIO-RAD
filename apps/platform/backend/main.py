"""ConnectIO Platform — unified FastAPI entry point.

Serves ConnectedQuality (at /cq), ProcessOrderHistory (at /poh), and
Warehouse360 (at /warehouse360) from a single Databricks App process.

Backend packages are installed from local wheels produced by
``scripts/build.py``. Every router listed in ``CQ_ROUTERS``, ``POH_ROUTERS``,
and ``W360_ROUTERS`` is treated as *required*: an import failure aborts
startup rather than silently 404-ing the affected routes.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from starlette.staticfiles import StaticFiles

from shared_api import create_api_app, health_payload, databricks_sql_ready
from backend.routes.badges import router as badges_router
from backend.routes.session import router as session_router
from backend.utils import (
    _optional_attr,
    get_missing_optional_artifacts,
)

logger = logging.getLogger(__name__)


def _required_router(module_name: str) -> Any:
    """Import a router that is required for the platform to start.

    Args:
        module_name: Fully-qualified path of the router module.

    Returns:
        The router instance from that module.

    Raises:
        RequiredArtifactMissing: If the module or its ``router`` attribute is
            unavailable.
    """
    return _optional_attr(module_name, "router", required=True)


def _required_attr(module_name: str, attr_name: str) -> Any:
    """Import an attribute that is required at startup."""
    return _optional_attr(module_name, attr_name, required=True)


check_warehouse_config = _required_attr(
    "processorderhistory_backend.db", "check_warehouse_config"
)
run_sql_async = _required_attr("processorderhistory_backend.db", "run_sql_async")


# (router, mount_prefix, tags)
RouterEntry = tuple[Any, str, Optional[list[str]]]


CQ_ROUTERS: list[RouterEntry] = [
    (_required_router("connectedquality_backend.routers.trace"), "/api/cq", ["CQ-Trace"]),
    (_required_router("connectedquality_backend.routers.envmon"), "/api/cq", ["CQ-EnvMon"]),
    (_required_router("connectedquality_backend.routers.spc"), "/api/cq", ["CQ-SPC"]),
    (_required_router("connectedquality_backend.routers.lab"), "/api/cq", ["CQ-Lab"]),
    (_required_router("connectedquality_backend.user_preferences.router_me"), "/api/cq", ["CQ-Me"]),
    (_required_router("connectedquality_backend.routers.alarms"), "/api/cq", ["CQ-Alarms"]),
]

POH_ROUTERS: list[RouterEntry] = [
    (_required_router("processorderhistory_backend.order_execution.router_me"), "/api", None),
    (_required_router("processorderhistory_backend.order_execution.router_orders"), "/api", None),
    (_required_router("processorderhistory_backend.order_execution.router_order_detail"), "/api", None),
    (_required_router("processorderhistory_backend.order_execution.router_pours"), "/api", None),
    (_required_router("processorderhistory_backend.production_planning.router_planning"), "/api", None),
    (_required_router("processorderhistory_backend.order_execution.router_day_view"), "/api", None),
    (_required_router("processorderhistory_backend.manufacturing_analytics.router_yield"), "/api", None),
    (_required_router("processorderhistory_backend.manufacturing_analytics.router_quality"), "/api", None),
    (_required_router("processorderhistory_backend.manufacturing_analytics.router_downtime"), "/api", None),
    (_required_router("processorderhistory_backend.manufacturing_analytics.router_oee"), "/api", None),
    (_required_router("processorderhistory_backend.manufacturing_analytics.router_adherence"), "/api", None),
    (_required_router("processorderhistory_backend.genie_assist.router_genie"), "/api", None),
    (_required_router("processorderhistory_backend.production_planning.router_vessel_planning"), "/api", None),
    (_required_router("processorderhistory_backend.manufacturing_analytics.router_equipment_insights"), "/api", None),
    (_required_router("processorderhistory_backend.manufacturing_analytics.router_equipment_insights2"), "/api", None),
]

W360_ROUTERS: list[RouterEntry] = [
    (_required_router("warehouse360_backend.order_fulfillment.router_process_orders"), "/api/wh", ["W360-ProcessOrders"]),
    (_required_router("warehouse360_backend.order_fulfillment.router_deliveries"), "/api/wh", ["W360-Deliveries"]),
    (_required_router("warehouse360_backend.inventory_management.router_inbound"), "/api/wh", ["W360-Inbound"]),
    (_required_router("warehouse360_backend.inventory_management.router_inventory"), "/api/wh", ["W360-Inventory"]),
    (_required_router("warehouse360_backend.dispensary_ops.router_dispensary"), "/api/wh", ["W360-Dispensary"]),
    (_required_router("warehouse360_backend.operations_control_tower.router_kpis"), "/api/wh", ["W360-KPIs"]),
    (_required_router("warehouse360_backend.inventory_management.router_plants"), "/api/wh", ["W360-Plants"]),
    (_required_router("warehouse360_backend.inventory_management.router_imwm"), "/api/wh", ["W360-IMWM"]),
]

_STATIC = Path(__file__).parent.parent / "static"
CQ_STATIC = _STATIC / "cq"
POH_STATIC = _STATIC / "poh"
W360_STATIC = _STATIC / "warehouse360"
HOME_STATIC = _STATIC / "home"
ENZYMES_STATIC    = _STATIC / "enzymes"
PI_SHEET_STATIC   = _STATIC / "pi-sheet"
WAREHOUSE_STATIC  = _STATIC / "warehouse"
MAINTENANCE_STATIC = _STATIC / "maintenance"
TPM_STATIC        = _STATIC / "tpm"
IMWM_STATIC       = _STATIC / "imwm"
PEX_E35_STATIC    = _STATIC / "pex-e-35"
LINESIDE_STATIC   = _STATIC / "lineside-monitor"

app = create_api_app(title="ConnectIO Platform API")


def _include_required_routers() -> None:
    """Mount all required app routers onto the platform FastAPI app.

    Routers in CQ/POH/W360 lists are guaranteed non-None (their imports above
    are ``required=True`` and would have raised at module load otherwise).
    """
    for router, prefix, tags in [*CQ_ROUTERS, *POH_ROUTERS, *W360_ROUTERS]:
        kwargs: dict[str, Any] = {"prefix": prefix}
        if tags is not None:
            kwargs["tags"] = tags
        app.include_router(router, **kwargs)


_include_required_routers()
app.include_router(badges_router)
app.include_router(session_router)


@app.get("/api/health", include_in_schema=False)
async def health():
    """Liveness probe."""
    return health_payload()


@app.get("/api/ready", include_in_schema=False)
async def ready():
    """Readiness probe — verifies POH warehouse connectivity.

    Required-artifact failures abort startup, so the only runtime readiness
    concern is the SQL warehouse roundtrip.
    """
    return await databricks_sql_ready(
        check_warehouse_config=check_warehouse_config,
        run_sql=run_sql_async,
        endpoint_hint="platform.ready",
    )


@app.get("/api/health/routers", include_in_schema=False)
async def routers_health():
    """Inventory of registered API routes plus any optional artifacts that
    failed to import.

    Returns:
        Object with:
            * ``registered``: list of route paths the platform is serving.
            * ``registered_count``: ``len(registered)``.
            * ``missing_optional``: map of artifact key to import-error string,
              one entry per optional artifact that failed to load.
    """
    registered = sorted(
        route.path for route in app.routes if hasattr(route, "path")
    )
    return {
        "registered": registered,
        "registered_count": len(registered),
        "missing_optional": get_missing_optional_artifacts(),
    }


# Static mounts AFTER all API routes.
# StaticFiles(html=True) serves index.html for any path that doesn't match a file,
# enabling SPA client-side routing under each prefix.
if CQ_STATIC.exists():
    app.mount("/cq", StaticFiles(directory=str(CQ_STATIC), html=True), name="cq")

if POH_STATIC.exists():
    app.mount("/poh", StaticFiles(directory=str(POH_STATIC), html=True), name="poh")

if W360_STATIC.exists():
    app.mount("/warehouse360", StaticFiles(directory=str(W360_STATIC), html=True), name="warehouse360")

if ENZYMES_STATIC.exists():
    app.mount("/enzymes", StaticFiles(directory=str(ENZYMES_STATIC), html=True), name="enzymes")

if PI_SHEET_STATIC.exists():
    app.mount("/pi-sheet", StaticFiles(directory=str(PI_SHEET_STATIC), html=True), name="pi-sheet")

if WAREHOUSE_STATIC.exists():
    app.mount("/warehouse", StaticFiles(directory=str(WAREHOUSE_STATIC), html=True), name="warehouse")

if MAINTENANCE_STATIC.exists():
    app.mount("/maintenance", StaticFiles(directory=str(MAINTENANCE_STATIC), html=True), name="maintenance")

if TPM_STATIC.exists():
    app.mount("/tpm", StaticFiles(directory=str(TPM_STATIC), html=True), name="tpm")

if IMWM_STATIC.exists():
    app.mount("/imwm", StaticFiles(directory=str(IMWM_STATIC), html=True), name="imwm")

if PEX_E35_STATIC.exists():
    app.mount("/pex-e-35", StaticFiles(directory=str(PEX_E35_STATIC), html=True), name="pex-e-35")

if LINESIDE_STATIC.exists():
    app.mount("/lineside-monitor", StaticFiles(directory=str(LINESIDE_STATIC), html=True), name="lineside-monitor")

if HOME_STATIC.exists():
    app.mount("/", StaticFiles(directory=str(HOME_STATIC), html=True), name="home")
