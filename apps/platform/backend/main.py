"""ConnectIO Platform â€” unified FastAPI entry point.

Serves ConnectedQuality (at /cq), ProcessOrderHistory (at /poh), and
Warehouse360 (at /warehouse360) from a single Databricks App process.

IMPORTANT: This module cannot be run standalone. It imports from poh_backend,
cq_backend, and w360_backend which are build artifacts produced by scripts/build.py.
Run `python3 scripts/build.py` first, then deploy via `make deploy`.
"""
from pathlib import Path

from starlette.staticfiles import StaticFiles

from shared_api import create_api_app, health_payload, databricks_sql_ready

# CQ API routers (build.py rewrites backend.* imports to cq_backend.*)
from cq_backend.routers.alarms import router as cq_alarms_router
from cq_backend.routers.envmon import router as cq_envmon_router
from cq_backend.routers.lab import router as cq_lab_router
from cq_backend.routers.spc import router as cq_spc_router
from cq_backend.routers.trace import router as cq_trace_router
from cq_backend.routers.me_router import router as cq_me_router

# POH API routers â€” imports rewritten from backend.* to poh_backend.* by build.py
from poh_backend.db import check_warehouse_config, run_sql_async
from poh_backend.routers.me_router import router as poh_me_router
from poh_backend.routers.orders import router as poh_orders_router
from poh_backend.routers.order_detail_router import router as poh_order_detail_router
from poh_backend.routers.pours_router import router as poh_pours_router
from poh_backend.routers.planning_router import router as poh_planning_router
from poh_backend.routers.day_view_router import router as poh_day_view_router
from poh_backend.routers.yield_router import router as poh_yield_router
from poh_backend.routers.quality_router import router as poh_quality_router
from poh_backend.routers.downtime_router import router as poh_downtime_router
from poh_backend.routers.oee_router import router as poh_oee_router
from poh_backend.routers.adherence_router import router as poh_adherence_router
from poh_backend.routers.genie_router import router as poh_genie_router
from poh_backend.routers.vessel_planning_router import router as poh_vessel_planning_router
from poh_backend.routers.equipment_insights_router import router as poh_equipment_insights_router
from poh_backend.routers.equipment_insights2_router import router as poh_equipment_insights2_router

# W360 API routers â€” imports rewritten from backend.* to w360_backend.* by build.py
from w360_backend.routers.process_orders import router as w360_process_orders_router
from w360_backend.routers.deliveries import router as w360_deliveries_router
from w360_backend.routers.inbound import router as w360_inbound_router
from w360_backend.routers.inventory import router as w360_inventory_router
from w360_backend.routers.dispensary import router as w360_dispensary_router
from w360_backend.routers.kpis import router as w360_kpis_router
from w360_backend.routers.plants import router as w360_plants_router

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

# --- CQ API (/api/cq/...) ---
app.include_router(cq_trace_router, prefix="/api/cq", tags=["CQ-Trace"])
app.include_router(cq_envmon_router, prefix="/api/cq", tags=["CQ-EnvMon"])
app.include_router(cq_spc_router, prefix="/api/cq", tags=["CQ-SPC"])
app.include_router(cq_lab_router, prefix="/api/cq", tags=["CQ-Lab"])
app.include_router(cq_me_router, prefix="/api/cq", tags=["CQ-Me"])
app.include_router(cq_alarms_router, prefix="/api/cq", tags=["CQ-Alarms"])

# --- POH API (/api/...) ---
app.include_router(poh_me_router, prefix="/api")
app.include_router(poh_orders_router, prefix="/api")
app.include_router(poh_order_detail_router, prefix="/api")
app.include_router(poh_pours_router, prefix="/api")
app.include_router(poh_planning_router, prefix="/api")
app.include_router(poh_day_view_router, prefix="/api")
app.include_router(poh_yield_router, prefix="/api")
app.include_router(poh_quality_router, prefix="/api")
app.include_router(poh_downtime_router, prefix="/api")
app.include_router(poh_oee_router, prefix="/api")
app.include_router(poh_adherence_router, prefix="/api")
app.include_router(poh_genie_router, prefix="/api")
app.include_router(poh_vessel_planning_router, prefix="/api")
app.include_router(poh_equipment_insights_router, prefix="/api")
app.include_router(poh_equipment_insights2_router, prefix="/api")

# --- W360 API (/api/wh/...) ---
app.include_router(w360_process_orders_router, prefix="/api/wh", tags=["W360-ProcessOrders"])
app.include_router(w360_deliveries_router, prefix="/api/wh", tags=["W360-Deliveries"])
app.include_router(w360_inbound_router, prefix="/api/wh", tags=["W360-Inbound"])
app.include_router(w360_inventory_router, prefix="/api/wh", tags=["W360-Inventory"])
app.include_router(w360_dispensary_router, prefix="/api/wh", tags=["W360-Dispensary"])
app.include_router(w360_kpis_router, prefix="/api/wh", tags=["W360-KPIs"])
app.include_router(w360_plants_router, prefix="/api/wh", tags=["W360-Plants"])


@app.get("/api/health", include_in_schema=False)
async def health():
    """Liveness probe."""
    return health_payload()


@app.get("/api/ready", include_in_schema=False)
async def ready():
    """Readiness probe â€” POH warehouse connectivity."""
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
