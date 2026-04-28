"""Process Order History — FastAPI entry."""
from pathlib import Path

from starlette.requests import Request as StarletteRequest

from shared_api import (
    create_api_app,
    health_payload,
    register_spa_routes,
    safe_global_exception_response,
)
from backend.db import check_warehouse_config
from backend.routers.me_router import router as me_router
from backend.routers.orders import router as orders_router
from backend.routers.order_detail_router import router as order_detail_router
from backend.routers.pours_router import router as pours_router

STATIC_DIR: Path = Path(__file__).parent.parent / "frontend" / "dist"

app = create_api_app(title="Process Order History API")
app.include_router(me_router, prefix="/api")
app.include_router(orders_router, prefix="/api")
app.include_router(order_detail_router, prefix="/api")
app.include_router(pours_router, prefix="/api")


@app.exception_handler(Exception)
async def global_exception_handler(request: StarletteRequest, exc: Exception):
    return await safe_global_exception_response(request, exc, logger_name=__name__)


@app.get("/api/health")
async def health():
    """Liveness probe for the Databricks Apps load balancer."""
    return health_payload()


@app.get("/api/ready")
async def ready():
    """Readiness probe — verifies warehouse config is present."""
    check_warehouse_config()
    return {"status": "ok"}


register_spa_routes(app, static_dir_getter=lambda: STATIC_DIR)
