from pathlib import Path

from starlette.requests import Request as StarletteRequest

from shared_api import (
    create_api_app,
    health_payload,
    register_spa_routes,
    safe_global_exception_response,
)

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


register_spa_routes(app, static_dir_getter=lambda: STATIC_DIR)
