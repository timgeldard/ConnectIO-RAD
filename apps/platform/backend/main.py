"""ConnectIO Platform - unified FastAPI entry point.

Serves ConnectedQuality (at /cq), ProcessOrderHistory (at /poh), and
Warehouse360 (at /warehouse360) from a single Databricks App process.

Backend bundles are produced by scripts/build.py. The module is still importable
before that build step so health/readiness can report a clear degraded state.
"""
import logging
from pathlib import Path
from typing import Any

from fastapi import HTTPException
from starlette.staticfiles import StaticFiles

from shared_api import create_api_app, health_payload, databricks_sql_ready
from backend.routes.badges import router as badges_router
from backend.utils import _optional_attr, get_missing_artifacts

logger = logging.getLogger(__name__)
_missing_build_artifacts = get_missing_artifacts()


def _optional_router(module_name: str, artifact: str) -> Any | None:
    """Return a router from an optional app module, or None if the artifact is unavailable."""
    return _optional_attr(module_name, "router", artifact)


check_warehouse_config = _optional_attr(
    "processorderhistory_backend.db",
    "check_warehouse_config",
    "processorderhistory_backend",
)
run_sql_async = _optional_attr("processorderhistory_backend.db", "run_sql_async", "processorderhistory_backend")

CQ_ROUTERS = [
    (_optional_router("connectedquality_backend.routers.trace", "connectedquality_backend"), "/api/cq", ["CQ-Trace"]),
    (_optional_router("connectedquality_backend.routers.envmon", "connectedquality_backend"), "/api/cq", ["CQ-EnvMon"]),
    (_optional_router("connectedquality_backend.routers.spc", "connectedquality_backend"), "/api/cq", ["CQ-SPC"]),
    (_optional_router("connectedquality_backend.routers.lab", "connectedquality_backend"), "/api/cq", ["CQ-Lab"]),
    (
        _optional_router("connectedquality_backend.user_preferences.router_me", "connectedquality_backend"),
        "/api/cq",
        ["CQ-Me"],
    ),
    (_optional_router("connectedquality_backend.routers.alarms", "connectedquality_backend"), "/api/cq", ["CQ-Alarms"]),
]

POH_ROUTERS = [
    (_optional_router("processorderhistory_backend.order_execution.router_me", "processorderhistory_backend"), "/api", None),
    (_optional_router("processorderhistory_backend.order_execution.router_orders", "processorderhistory_backend"), "/api", None),
    (
        _optional_router("processorderhistory_backend.order_execution.router_order_detail", "processorderhistory_backend"),
        "/api",
        None,
    ),
    (_optional_router("processorderhistory_backend.order_execution.router_pours", "processorderhistory_backend"), "/api", None),
    (
        _optional_router("processorderhistory_backend.production_planning.router_planning", "processorderhistory_backend"),
        "/api",
        None,
    ),
    (
        _optional_router("processorderhistory_backend.order_execution.router_day_view", "processorderhistory_backend"),
        "/api",
        None,
    ),
    (
        _optional_router("processorderhistory_backend.manufacturing_analytics.router_yield", "processorderhistory_backend"),
        "/api",
        None,
    ),
    (
        _optional_router("processorderhistory_backend.manufacturing_analytics.router_quality", "processorderhistory_backend"),
        "/api",
        None,
    ),
    (
        _optional_router("processorderhistory_backend.manufacturing_analytics.router_downtime", "processorderhistory_backend"),
        "/api",
        None,
    ),
    (
        _optional_router("processorderhistory_backend.manufacturing_analytics.router_oee", "processorderhistory_backend"),
        "/api",
        None,
    ),
    (
        _optional_router("processorderhistory_backend.manufacturing_analytics.router_adherence", "processorderhistory_backend"),
        "/api",
        None,
    ),
    (
        _optional_router("processorderhistory_backend.genie_assist.router_genie", "processorderhistory_backend"),
        "/api",
        None,
    ),
    (
        _optional_router(
            "processorderhistory_backend.production_planning.router_vessel_planning",
            "processorderhistory_backend",
        ),
        "/api",
        None,
    ),
    (
        _optional_router(
            "processorderhistory_backend.manufacturing_analytics.router_equipment_insights",
            "processorderhistory_backend",
        ),
        "/api",
        None,
    ),
    (
        _optional_router(
            "processorderhistory_backend.manufacturing_analytics.router_equipment_insights2",
            "processorderhistory_backend",
        ),
        "/api",
        None,
    ),
]

W360_ROUTERS = [
    (
        _optional_router("warehouse360_backend.order_fulfillment.router_process_orders", "warehouse360_backend"),
        "/api/wh",
        ["W360-ProcessOrders"],
    ),
    (
        _optional_router("warehouse360_backend.order_fulfillment.router_deliveries", "warehouse360_backend"),
        "/api/wh",
        ["W360-Deliveries"],
    ),
    (
        _optional_router("warehouse360_backend.inventory_management.router_inbound", "warehouse360_backend"),
        "/api/wh",
        ["W360-Inbound"],
    ),
    (
        _optional_router("warehouse360_backend.inventory_management.router_inventory", "warehouse360_backend"),
        "/api/wh",
        ["W360-Inventory"],
    ),
    (
        _optional_router("warehouse360_backend.dispensary_ops.router_dispensary", "warehouse360_backend"),
        "/api/wh",
        ["W360-Dispensary"],
    ),
    (
        _optional_router("warehouse360_backend.operations_control_tower.router_kpis", "warehouse360_backend"),
        "/api/wh",
        ["W360-KPIs"],
    ),
    (
        _optional_router("warehouse360_backend.inventory_management.router_plants", "warehouse360_backend"),
        "/api/wh",
        ["W360-Plants"],
    ),
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


def _include_available_routers() -> None:
    """Mount all available app routers onto the platform FastAPI app, skipping absent ones."""
    for router, prefix, tags in [*CQ_ROUTERS, *POH_ROUTERS, *W360_ROUTERS]:
        if router is None:
            continue
        kwargs = {"prefix": prefix}
        if tags is not None:
            kwargs["tags"] = tags
        app.include_router(router, **kwargs)

    if _missing_build_artifacts:
        logger.warning(
            "Platform started with missing build artifacts: %s. Some routes will return 404.",
            ", ".join(sorted(_missing_build_artifacts.keys())),
        )


_include_available_routers()
app.include_router(badges_router)


@app.get("/api/health", include_in_schema=False)
async def health():
    """Liveness probe."""
    return health_payload()


@app.get("/api/ready", include_in_schema=False)
async def ready():
    """Readiness probe - build artifacts and POH warehouse connectivity."""
    if _missing_build_artifacts:
        raise HTTPException(
            status_code=503,
            detail={
                "status": "not_ready",
                "reason": "platform_build_artifacts_missing",
                "artifacts": sorted(_missing_build_artifacts),
            },
        )
    if check_warehouse_config is None or run_sql_async is None:
        raise HTTPException(
            status_code=503,
            detail={"status": "not_ready", "reason": "processorderhistory_backend_unavailable"},
        )
    return await databricks_sql_ready(
        check_warehouse_config=check_warehouse_config,
        run_sql=run_sql_async,
        endpoint_hint="platform.ready",
    )


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
