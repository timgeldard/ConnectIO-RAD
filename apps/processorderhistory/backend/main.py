"""Process Order History — FastAPI entry."""
from pathlib import Path

from shared_api import (
    create_api_app,
    databricks_sql_ready,
    health_payload,
    register_spa_routes,
)
from backend.db import check_warehouse_config, run_sql_async
from backend.routers.me_router import router as me_router
from backend.routers.orders import router as orders_router
from backend.routers.order_detail_router import router as order_detail_router
from backend.routers.pours_router import router as pours_router
from backend.routers.planning_router import router as planning_router
from backend.routers.day_view_router import router as day_view_router
from backend.routers.yield_router import router as yield_router
from backend.routers.quality_router import router as quality_router

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
