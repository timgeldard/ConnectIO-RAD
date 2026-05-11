import os
from pathlib import Path

from trace2_backend.batch_trace.router import router as batch_trace_router
from trace2_backend.lineage_analysis.router import router as lineage_router
from trace2_backend.quality_record.router import router as quality_router
from trace2_backend.utils.db import (
    DATABRICKS_HOST,
    TRACE_CATALOG,
    TRACE_SCHEMA,
    WAREHOUSE_HTTP_PATH,
    check_warehouse_config,
    hostname,
    run_sql_async,
)
from shared_api import ConnectIoApp, databricks_sql_ready
from shared_auth import UserIdentity

STATIC_DIR: Path = Path(__file__).parent.parent / "frontend" / "dist"


async def trace_readiness_check() -> dict:
    """Readiness probe logic — verifies warehouse connectivity."""
    from fastapi import HTTPException
    from shared_db.errors import WarehouseNotConfiguredError

    try:
        check_warehouse_config()
    except WarehouseNotConfiguredError:
        from shared_api import not_ready
        raise not_ready(
            "warehouse_config_missing",
            message="Warehouse configuration is missing or invalid.",
        )

    try:
        return await databricks_sql_ready(
            check_warehouse_config=check_warehouse_config,
            run_sql=run_sql_async,
        )
    except HTTPException as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={
                "reason": "sql_warehouse_unreachable",
                "message": "An internal error occurred while reaching the SQL warehouse.",
                "error": str(exc.detail),
            },
        )


async def trace_debug_config(_user: UserIdentity) -> dict:
    """Runtime configuration summary for debugging."""
    return {
        "status": "ok",
        "databricks_host": DATABRICKS_HOST[:50] if DATABRICKS_HOST else "(NOT SET)",
        "hostname_resolved": hostname()[:50] if hostname() else "(EMPTY)",
        "warehouse_http_path": WAREHOUSE_HTTP_PATH if WAREHOUSE_HTTP_PATH else "(NOT SET)",
        "trace_catalog": TRACE_CATALOG,
        "trace_schema": TRACE_SCHEMA,
        "static_dir_exists": STATIC_DIR.exists(),
        "python_version": __import__("sys").version,
    }


# Bootstrap the application using the ConnectIO framework
rad_app = ConnectIoApp(
    title="Trace2 API",
    static_dir=STATIC_DIR,
    readiness_checks=[trace_readiness_check],
    debug_config=trace_debug_config,
)

# Domain Router Registration — must happen BEFORE mount_spa() / fastapi_app
# access, because the SPA catch-all would otherwise shadow these routes.
rad_app.include_router(batch_trace_router, prefix="/api/t2", tags=["Batch Trace"])
rad_app.include_router(lineage_router, prefix="/api/t2", tags=["Lineage Analysis"])
rad_app.include_router(quality_router, prefix="/api/t2", tags=["Quality Record"])

rad_app.mount_spa()
app = rad_app.fastapi_app
