from pathlib import Path

from envmon_backend.inspection_analysis.router import router as inspection_router
from envmon_backend.spatial_config.router import router as spatial_router
from envmon_backend.utils.db import (
    check_warehouse_config,
    run_sql,
)
from shared_api import ConnectIoApp, databricks_sql_ready
from shared_db.errors import send_operational_alert

STATIC_DIR: Path = Path(__file__).parent.parent / "frontend" / "dist"

# Bootstrap the application using the ConnectIO framework
rad_app = ConnectIoApp(
    title="EM Visualisation API",
    static_dir=STATIC_DIR,
    latency_alert_callback=lambda path, dur, bud, status: send_operational_alert(
        subject="Latency budget exceeded",
        body=f"Request to {path} completed in {dur} ms (budget {bud} ms, status {status}).",
        request_path=path,
    ),
    readiness_checks=[
        lambda: databricks_sql_ready(check_warehouse_config=check_warehouse_config, run_sql=run_sql)
    ],
)

app = rad_app.fastapi_app

# Domain Router Registration
app.include_router(inspection_router, prefix="/api/em", tags=["Inspection Analysis"])
app.include_router(spatial_router, prefix="/api/em", tags=["Spatial Config"])
