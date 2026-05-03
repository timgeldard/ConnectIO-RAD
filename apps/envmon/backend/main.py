from pathlib import Path

from backend.inspection_analysis.router import router as inspection_router
from backend.spatial_config.router import router as spatial_router
from backend.utils.db import (
    check_warehouse_config,
    run_sql,
)
from shared_api import (
    create_api_app,
    databricks_sql_ready,
    health_payload,
    register_spa_routes,
)
from shared_db.errors import send_operational_alert

STATIC_DIR: Path = Path(__file__).parent.parent / "frontend" / "dist"

app = create_api_app(
    title="EM Visualisation API",
    latency_alert_callback=lambda path, dur, bud, status: send_operational_alert(
        subject="Latency budget exceeded",
        body=f"Request to {path} completed in {dur} ms (budget {bud} ms, status {status}).",
        request_path=path,
    ),
)

app.include_router(inspection_router, prefix="/api/em", tags=["Inspection Analysis"])
app.include_router(spatial_router, prefix="/api/em", tags=["Spatial Config"])


@app.get("/api/health")
async def health():
    return health_payload()


@app.get("/api/ready")
async def ready():
    return await databricks_sql_ready(check_warehouse_config=check_warehouse_config, run_sql=run_sql)


register_spa_routes(app, static_dir_getter=lambda: STATIC_DIR)
