"""Process Order History — FastAPI entry.

Boots the SPA + a small surface of read-only API endpoints. The current build
exposes only health and readiness probes; the React frontend ships with mock
data sourced from `frontend/src/data/mock.ts`. Wiring against
`connected_plant_uat.csm_process_order_history.*` views is tracked in
`docs/architecture.md` and lives behind future routers under `backend/routers/`.
"""

from pathlib import Path

from starlette.requests import Request as StarletteRequest

from shared_api import (
    create_api_app,
    health_payload,
    register_spa_routes,
    safe_global_exception_response,
)

STATIC_DIR: Path = Path(__file__).parent.parent / "frontend" / "dist"

app = create_api_app(title="Process Order History API")


@app.exception_handler(Exception)
async def global_exception_handler(request: StarletteRequest, exc: Exception):
    return await safe_global_exception_response(request, exc, logger_name=__name__)


@app.get("/api/health")
async def health():
    """Liveness probe for the Databricks Apps load balancer."""
    return health_payload()


@app.get("/api/ready")
async def ready():
    """Readiness probe.

    Returns 200 immediately because the current build serves only static
    assets and in-memory mock data. When SQL-backed routers are added, swap
    this for a `databricks_sql_ready` call (see trace2 for reference).
    """
    return {"status": "ok"}


register_spa_routes(app, static_dir_getter=lambda: STATIC_DIR)
