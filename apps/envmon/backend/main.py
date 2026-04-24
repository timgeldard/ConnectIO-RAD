from pathlib import Path

from starlette.requests import Request as StarletteRequest

from backend.routers.coordinates import router as coordinates_router
from backend.routers.floors import router as floors_router
from backend.routers.heatmap import router as heatmap_router
from backend.routers.lots import router as lots_router
from backend.routers.plant_geo import router as plant_geo_router
from backend.routers.plants import router as plants_router
from backend.routers.trends import router as trends_router
from backend.utils.db import (
    check_warehouse_config,
    run_sql,
)
from backend.utils.rate_limit import (
    RateLimitExceeded,
    SlowAPIMiddleware,
    limiter,
    rate_limit_handler,
)
from shared_api import (
    create_api_app,
    databricks_sql_ready,
    health_payload,
    register_spa_routes,
    safe_global_exception_response,
)

STATIC_DIR: Path = Path(__file__).parent.parent / "frontend" / "dist"

app = create_api_app(
    title="EM Visualisation API",
    limiter=limiter,
    rate_limit_exception=RateLimitExceeded,
    rate_limit_handler=rate_limit_handler,
    slowapi_middleware=SlowAPIMiddleware,
)

app.include_router(plants_router, prefix="/api/em", tags=["Plants"])
app.include_router(floors_router, prefix="/api/em", tags=["Floors"])
app.include_router(heatmap_router, prefix="/api/em", tags=["Heatmap"])
app.include_router(trends_router, prefix="/api/em", tags=["Trends"])
app.include_router(lots_router, prefix="/api/em", tags=["Lots"])
app.include_router(coordinates_router, prefix="/api/em", tags=["Coordinates"])
app.include_router(plant_geo_router, prefix="/api/em", tags=["PlantGeo"])


@app.exception_handler(Exception)
async def global_exception_handler(request: StarletteRequest, exc: Exception):
    return await safe_global_exception_response(request, exc, logger_name=__name__)


@app.get("/api/health")
async def health():
    return health_payload()


@app.get("/api/ready")
async def ready():
    return await databricks_sql_ready(check_warehouse_config=check_warehouse_config, run_sql=run_sql)


register_spa_routes(app, static_dir_getter=lambda: STATIC_DIR)
