"""ConnectedQuality FastAPI application entry point.

Bootstraps the app via the shared :class:`ConnectIoApp` framework so the
liveness/readiness probes, SPA mounting, and debug-endpoint scaffolding
are uniform with envmon, spc, and trace2.
"""

from pathlib import Path

from connectedquality_backend.db import check_warehouse_config, run_sql_async
from connectedquality_backend.routers.alarms import router as alarms_router
from connectedquality_backend.routers.envmon import router as envmon_router
from connectedquality_backend.routers.lab import router as lab_router
from connectedquality_backend.user_preferences.router_me import router as me_router
from connectedquality_backend.routers.spc import router as spc_router
from connectedquality_backend.routers.trace import router as trace_router
from shared_api import ConnectIoApp, databricks_sql_ready

STATIC_DIR: Path = Path(__file__).parent.parent / "frontend" / "dist"


async def cq_readiness_check() -> dict:
    """Confirm the Databricks SQL warehouse is reachable for CQ workloads."""
    return await databricks_sql_ready(
        check_warehouse_config=check_warehouse_config,
        run_sql=run_sql_async,
        endpoint_hint="cq.ready",
    )


rad_app = ConnectIoApp(
    title="ConnectedQuality API",
    static_dir=STATIC_DIR,
    readiness_checks=[cq_readiness_check],
)

# Domain Router Registration — must happen BEFORE mount_spa() / fastapi_app
# access, because the SPA catch-all would otherwise shadow these routes.
rad_app.include_router(me_router, prefix="/api/cq", tags=["Me"])
rad_app.include_router(trace_router, prefix="/api/cq", tags=["Trace"])
rad_app.include_router(envmon_router, prefix="/api/cq", tags=["EnvMon"])
rad_app.include_router(spc_router, prefix="/api/cq", tags=["SPC"])
rad_app.include_router(lab_router, prefix="/api/cq", tags=["Lab"])
rad_app.include_router(alarms_router, prefix="/api/cq", tags=["Alarms"])

rad_app.mount_spa()
app = rad_app.fastapi_app
