"""Process Order History — FastAPI entry.

Bootstraps via the shared :class:`ConnectIoApp` framework so liveness /
readiness probes, SPA mounting, and debug-endpoint scaffolding are uniform
with envmon, spc, trace2, and connectedquality.
"""
from pathlib import Path

from shared_api import ConnectIoApp, databricks_sql_ready
from shared_db.errors import send_operational_alert

from processorderhistory_backend.db import check_warehouse_config, run_sql_async
from processorderhistory_backend.order_execution.router_me import router as me_router
from processorderhistory_backend.order_execution.router_orders import router as orders_router
from processorderhistory_backend.order_execution.router_order_detail import router as order_detail_router
from processorderhistory_backend.order_execution.router_pours import router as pours_router
from processorderhistory_backend.order_execution.router_day_view import router as day_view_router
from processorderhistory_backend.order_execution.router_lineside_monitor import router as lineside_monitor_router
from processorderhistory_backend.production_planning.router_planning import router as planning_router
from processorderhistory_backend.production_planning.router_vessel_planning import router as vessel_planning_router
from processorderhistory_backend.manufacturing_analytics.router_yield import router as yield_router
from processorderhistory_backend.manufacturing_analytics.router_quality import router as quality_router
from processorderhistory_backend.manufacturing_analytics.router_downtime import router as downtime_router
from processorderhistory_backend.manufacturing_analytics.router_oee import router as oee_router
from processorderhistory_backend.manufacturing_analytics.router_adherence import router as adherence_router
from processorderhistory_backend.manufacturing_analytics.router_equipment_insights import router as equipment_insights_router
from processorderhistory_backend.manufacturing_analytics.router_equipment_insights2 import router as equipment_insights2_router
from processorderhistory_backend.genie_assist.router_genie import router as genie_router
from processorderhistory_backend.routers.plants_router import router as plants_router

STATIC_DIR: Path = Path(__file__).parent.parent / "frontend" / "dist"

LATENCY_BUDGETS_MS = {
    "/api/orders": 5_000,
    "/api/oee/analytics": 8_000,
    "/api/downtime": 5_000,
    "/api/adherence": 5_000,
    "/api/yield": 5_000,
    "/api/quality/analytics": 5_000,
    "/api/planning/schedule": 8_000,
}


async def poh_readiness_check() -> dict:
    """Confirm the Databricks SQL warehouse is reachable for POH workloads."""
    return await databricks_sql_ready(
        check_warehouse_config=check_warehouse_config,
        run_sql=run_sql_async,
        endpoint_hint="poh.ready",
    )


rad_app = ConnectIoApp(
    title="Process Order History API",
    static_dir=STATIC_DIR,
    latency_budgets_ms=LATENCY_BUDGETS_MS,
    latency_alert_callback=lambda path, dur, bud, status: send_operational_alert(
        subject="Latency budget exceeded",
        body=f"Request to {path} completed in {dur} ms (budget {bud} ms, status {status}).",
        request_path=path,
    ),
    readiness_checks=[poh_readiness_check],
)

# Domain Router Registration — must happen BEFORE mount_spa() / fastapi_app
# access, because the SPA catch-all would otherwise shadow these routes.
rad_app.include_router(me_router, prefix="/api/poh")
rad_app.include_router(plants_router, prefix="/api/poh")
rad_app.include_router(orders_router, prefix="/api/poh")
rad_app.include_router(order_detail_router, prefix="/api/poh")
rad_app.include_router(pours_router, prefix="/api/poh")
rad_app.include_router(planning_router, prefix="/api/poh")
rad_app.include_router(day_view_router, prefix="/api/poh")
rad_app.include_router(lineside_monitor_router, prefix="/api/poh")
rad_app.include_router(yield_router, prefix="/api/poh")
rad_app.include_router(quality_router, prefix="/api/poh")
rad_app.include_router(downtime_router, prefix="/api/poh")
rad_app.include_router(oee_router, prefix="/api/poh")
rad_app.include_router(adherence_router, prefix="/api/poh")
rad_app.include_router(genie_router, prefix="/api/poh")
rad_app.include_router(vessel_planning_router, prefix="/api/poh")
rad_app.include_router(equipment_insights_router, prefix="/api/poh")
rad_app.include_router(equipment_insights2_router, prefix="/api/poh")

rad_app.mount_spa()
app = rad_app.fastapi_app
