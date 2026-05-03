"""ConnectIO Platform - unified FastAPI entry point.

Serves ConnectedQuality (at /cq), ProcessOrderHistory (at /poh), and
Warehouse360 (at /warehouse360) from a single Databricks App process.

Backend bundles are produced by scripts/build.py. The module is still importable
before that build step so health/readiness can report a clear degraded state.
"""
from importlib import import_module
from pathlib import Path
from typing import Any

from fastapi import HTTPException
from starlette.staticfiles import StaticFiles

from shared_api import create_api_app, health_payload, databricks_sql_ready

_missing_build_artifacts: dict[str, str] = {}


def _optional_attr(module_name: str, attr_name: str, artifact: str) -> Any | None:
    try:
        return getattr(import_module(module_name), attr_name)
    except ModuleNotFoundError as exc:
        _missing_build_artifacts[artifact] = str(exc)
        return None


def _optional_router(module_name: str, artifact: str) -> Any | None:
    return _optional_attr(module_name, "router", artifact)


check_warehouse_config = _optional_attr("poh_backend.db", "check_warehouse_config", "poh_backend")
run_sql_async = _optional_attr("poh_backend.db", "run_sql_async", "poh_backend")

CQ_ROUTERS = [
    (_optional_router("cq_backend.routers.trace", "cq_backend"), "/api/cq", ["CQ-Trace"]),
    (_optional_router("cq_backend.routers.envmon", "cq_backend"), "/api/cq", ["CQ-EnvMon"]),
    (_optional_router("cq_backend.routers.spc", "cq_backend"), "/api/cq", ["CQ-SPC"]),
    (_optional_router("cq_backend.routers.lab", "cq_backend"), "/api/cq", ["CQ-Lab"]),
    (_optional_router("cq_backend.routers.me_router", "cq_backend"), "/api/cq", ["CQ-Me"]),
    (_optional_router("cq_backend.routers.alarms", "cq_backend"), "/api/cq", ["CQ-Alarms"]),
]

POH_ROUTERS = [
    (_optional_router("poh_backend.routers.me_router", "poh_backend"), "/api", None),
    (_optional_router("poh_backend.routers.orders", "poh_backend"), "/api", None),
    (_optional_router("poh_backend.routers.order_detail_router", "poh_backend"), "/api", None),
    (_optional_router("poh_backend.routers.pours_router", "poh_backend"), "/api", None),
    (_optional_router("poh_backend.routers.planning_router", "poh_backend"), "/api", None),
    (_optional_router("poh_backend.routers.day_view_router", "poh_backend"), "/api", None),
    (_optional_router("poh_backend.routers.yield_router", "poh_backend"), "/api", None),
    (_optional_router("poh_backend.routers.quality_router", "poh_backend"), "/api", None),
    (_optional_router("poh_backend.routers.downtime_router", "poh_backend"), "/api", None),
    (_optional_router("poh_backend.routers.oee_router", "poh_backend"), "/api", None),
    (_optional_router("poh_backend.routers.adherence_router", "poh_backend"), "/api", None),
    (_optional_router("poh_backend.routers.genie_router", "poh_backend"), "/api", None),
    (_optional_router("poh_backend.routers.vessel_planning_router", "poh_backend"), "/api", None),
    (_optional_router("poh_backend.routers.equipment_insights_router", "poh_backend"), "/api", None),
    (_optional_router("poh_backend.routers.equipment_insights2_router", "poh_backend"), "/api", None),
]

W360_ROUTERS = [
    (_optional_router("w360_backend.routers.process_orders", "w360_backend"), "/api/wh", ["W360-ProcessOrders"]),
    (_optional_router("w360_backend.routers.deliveries", "w360_backend"), "/api/wh", ["W360-Deliveries"]),
    (_optional_router("w360_backend.routers.inbound", "w360_backend"), "/api/wh", ["W360-Inbound"]),
    (_optional_router("w360_backend.routers.inventory", "w360_backend"), "/api/wh", ["W360-Inventory"]),
    (_optional_router("w360_backend.routers.dispensary", "w360_backend"), "/api/wh", ["W360-Dispensary"]),
    (_optional_router("w360_backend.routers.kpis", "w360_backend"), "/api/wh", ["W360-KPIs"]),
    (_optional_router("w360_backend.routers.plants", "w360_backend"), "/api/wh", ["W360-Plants"]),
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
    for router, prefix, tags in [*CQ_ROUTERS, *POH_ROUTERS, *W360_ROUTERS]:
        if router is None:
            continue
        kwargs = {"prefix": prefix}
        if tags is not None:
            kwargs["tags"] = tags
        app.include_router(router, **kwargs)


_include_available_routers()


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
            detail={"status": "not_ready", "reason": "poh_backend_unavailable"},
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
