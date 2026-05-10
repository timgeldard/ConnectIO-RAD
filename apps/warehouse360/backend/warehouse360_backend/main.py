"""Warehouse 360 — FastAPI entry.

Bootstraps via the shared :class:`ConnectIoApp` framework so liveness /
readiness probes, SPA mounting, and debug-endpoint scaffolding are uniform
with envmon, spc, trace2, processorderhistory, and connectedquality.
"""
from pathlib import Path

from shared_api import ConnectIoApp, databricks_sql_ready
from shared_db.errors import send_operational_alert

from warehouse360_backend.utils.db import check_warehouse_config, run_sql_async
from warehouse360_backend.order_fulfillment.router_process_orders import router as process_orders_router
from warehouse360_backend.order_fulfillment.router_deliveries import router as deliveries_router
from warehouse360_backend.inventory_management.router_inbound import router as inbound_router
from warehouse360_backend.inventory_management.router_inventory import router as inventory_router
from warehouse360_backend.inventory_management.router_imwm import router as imwm_router
from warehouse360_backend.dispensary_ops.router_dispensary import router as dispensary_router
from warehouse360_backend.operations_control_tower.router_kpis import router as kpis_router
from warehouse360_backend.inventory_management.router_plants import router as plants_router

STATIC_DIR: Path = Path(__file__).parent.parent / "frontend" / "dist"

LATENCY_BUDGETS_MS = {
    "/api/wh-cockpit": 5_000,
    "/api/deliveries": 5_000,
    "/api/inbound": 5_000,
    "/api/inventory/bins": 5_000,
    "/api/inventory/lineside": 5_000,
    "/api/dispensary": 5_000,
    "/api/kpis": 8_000,
}


async def wh360_readiness_check() -> dict:
    """Confirm the Databricks SQL warehouse is reachable for W360 workloads."""
    return await databricks_sql_ready(
        check_warehouse_config=check_warehouse_config,
        run_sql=run_sql_async,
        endpoint_hint="wh360.ready",
    )


rad_app = ConnectIoApp(
    title="Warehouse 360 API",
    static_dir=STATIC_DIR,
    latency_budgets_ms=LATENCY_BUDGETS_MS,
    latency_alert_callback=lambda path, dur, bud, status: send_operational_alert(
        subject="Latency budget exceeded",
        body=f"Request to {path} completed in {dur} ms (budget {bud} ms, status {status}).",
        request_path=path,
    ),
    readiness_checks=[wh360_readiness_check],
)

# Domain Router Registration — must happen BEFORE mount_spa() / fastapi_app
# access, because the SPA catch-all would otherwise shadow these routes.
rad_app.include_router(process_orders_router, prefix="/api/wh360")
rad_app.include_router(deliveries_router, prefix="/api/wh360")
rad_app.include_router(inbound_router, prefix="/api/wh360")
rad_app.include_router(inventory_router, prefix="/api/wh360")
rad_app.include_router(imwm_router, prefix="/api/wh360")
rad_app.include_router(dispensary_router, prefix="/api/wh360")
rad_app.include_router(kpis_router, prefix="/api/wh360")
rad_app.include_router(plants_router, prefix="/api/wh360")

rad_app.mount_spa()
app = rad_app.fastapi_app
