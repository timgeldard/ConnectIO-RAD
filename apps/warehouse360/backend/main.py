from pathlib import Path

from starlette.requests import Request as StarletteRequest

from shared_api import (
    create_api_app,
    health_payload,
    register_spa_routes,
    safe_global_exception_response,
)

from backend.routers.process_orders import router as process_orders_router
from backend.routers.deliveries import router as deliveries_router
from backend.routers.inbound import router as inbound_router
from backend.routers.inventory import router as inventory_router
from backend.routers.dispensary import router as dispensary_router
from backend.routers.kpis import router as kpis_router
from backend.routers.plants import router as plants_router

STATIC_DIR: Path = Path(__file__).parent.parent / "frontend" / "dist"

app = create_api_app(title="Warehouse 360 API")


@app.exception_handler(Exception)
async def global_exception_handler(request: StarletteRequest, exc: Exception):
    return await safe_global_exception_response(request, exc, logger_name=__name__)


@app.get("/api/health")
async def health():
    return health_payload()


@app.get("/api/ready")
async def ready():
    return {"status": "ok"}


app.include_router(process_orders_router, prefix="/api")
app.include_router(deliveries_router, prefix="/api")
app.include_router(inbound_router, prefix="/api")
app.include_router(inventory_router, prefix="/api")
app.include_router(dispensary_router, prefix="/api")
app.include_router(kpis_router, prefix="/api")
app.include_router(plants_router, prefix="/api")

register_spa_routes(app, static_dir_getter=lambda: STATIC_DIR)
