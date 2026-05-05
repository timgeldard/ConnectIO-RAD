"""ConnectedQuality FastAPI application entry point."""

from pathlib import Path

from connectedquality_backend.routers.alarms import router as alarms_router
from connectedquality_backend.routers.envmon import router as envmon_router
from connectedquality_backend.routers.lab import router as lab_router
from connectedquality_backend.user_preferences.router_me import router as me_router
from connectedquality_backend.routers.spc import router as spc_router
from connectedquality_backend.routers.trace import router as trace_router
from shared_api import (
    create_api_app,
    register_spa_routes,
    health_payload,
    databricks_sql_ready,
)

STATIC_DIR: Path = Path(__file__).parent.parent / "frontend" / "dist"

app = create_api_app(title="ConnectedQuality API")

app.include_router(me_router, prefix="/api/cq", tags=["Me"])
app.include_router(trace_router, prefix="/api/cq", tags=["Trace"])
app.include_router(envmon_router, prefix="/api/cq", tags=["EnvMon"])
app.include_router(spc_router, prefix="/api/cq", tags=["SPC"])
app.include_router(lab_router, prefix="/api/cq", tags=["Lab"])
app.include_router(alarms_router, prefix="/api/cq", tags=["Alarms"])


@app.get("/api/health")
async def health():
    """Liveness probe — always returns 200 while the process is up."""
    return health_payload()


@app.get("/api/ready")
async def ready():
    """Readiness probe — confirms Databricks SQL warehouse is reachable."""
    return await databricks_sql_ready()


register_spa_routes(app, static_dir_getter=lambda: STATIC_DIR)
