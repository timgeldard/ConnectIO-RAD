"""Process Order History — FastAPI entry."""
from pathlib import Path

from shared_api import (
    create_api_app,
    databricks_sql_ready,
    health_payload,
    register_spa_routes,
)
from processorderhistory_backend.db import check_warehouse_config, run_sql_async
from processorderhistory_backend.order_execution.router_me import router as me_router
from processorderhistory_backend.order_execution.router_orders import router as orders_router
from processorderhistory_backend.order_execution.router_order_detail import router as order_detail_router
from processorderhistory_backend.order_execution.router_pours import router as pours_router
from processorderhistory_backend.order_execution.router_day_view import router as day_view_router
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

STATIC_DIR: Path = Path(__file__).parent.parent / "frontend" / "dist"

app = create_api_app(title="Process Order History API")
app.include_router(me_router, prefix="/api")
app.include_router(orders_router, prefix="/api")
app.include_router(order_detail_router, prefix="/api")
app.include_router(pours_router, prefix="/api")
app.include_router(planning_router, prefix="/api")
app.include_router(day_view_router, prefix="/api")
app.include_router(yield_router, prefix="/api")
app.include_router(quality_router, prefix="/api")
app.include_router(downtime_router, prefix="/api")
app.include_router(oee_router, prefix="/api")
app.include_router(adherence_router, prefix="/api")
app.include_router(genie_router, prefix="/api")
app.include_router(vessel_planning_router, prefix="/api")
app.include_router(equipment_insights_router, prefix="/api")
app.include_router(equipment_insights2_router, prefix="/api")


@app.get("/api/health")
async def health():
    """Liveness probe for the Databricks Apps load balancer."""
    return health_payload()


@app.get("/api/ready")
async def ready():
    """Readiness probe — verifies warehouse config and SQL connectivity."""
    return await databricks_sql_ready(
        check_warehouse_config=check_warehouse_config,
        run_sql=run_sql_async,
        endpoint_hint="poh.ready",
    )


register_spa_routes(app, static_dir_getter=lambda: STATIC_DIR)
