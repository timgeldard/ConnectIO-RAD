from pathlib import Path

from shared_api import (
    create_api_app,
    databricks_sql_ready,
    health_payload,
    register_spa_routes,
)
from warehouse360_backend.utils.db import check_warehouse_config, run_sql_async
from shared_db.errors import send_operational_alert

from warehouse360_backend.order_fulfillment.router_process_orders import router as process_orders_router
from warehouse360_backend.order_fulfillment.router_deliveries import router as deliveries_router
from warehouse360_backend.inventory_management.router_inbound import router as inbound_router
from warehouse360_backend.inventory_management.router_inventory import router as inventory_router
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

app = create_api_app(
    title="Warehouse 360 API",
    latency_budgets_ms=LATENCY_BUDGETS_MS,
    latency_alert_callback=lambda path, dur, bud, status: send_operational_alert(
        subject="Latency budget exceeded",
        body=f"Request to {path} completed in {dur} ms (budget {bud} ms, status {status}).",
        request_path=path,
    ),
)


@app.get("/api/health")
async def health():
    """Liveness probe — always returns 200 while the process is up."""
    return health_payload()


@app.get("/api/ready")
async def ready():
    """Readiness probe — verifies warehouse config and SQL connectivity."""
    return await databricks_sql_ready(
        check_warehouse_config=check_warehouse_config,
        run_sql=run_sql_async,
        endpoint_hint="wh360.ready",
    )


app.include_router(process_orders_router, prefix="/api")
app.include_router(deliveries_router, prefix="/api")
app.include_router(inbound_router, prefix="/api")
app.include_router(inventory_router, prefix="/api")
app.include_router(dispensary_router, prefix="/api")
app.include_router(kpis_router, prefix="/api")
app.include_router(plants_router, prefix="/api")

register_spa_routes(app, static_dir_getter=lambda: STATIC_DIR)
