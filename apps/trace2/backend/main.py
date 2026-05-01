import os
from pathlib import Path
from typing import Optional

from fastapi import Header, HTTPException
from starlette.requests import Request as StarletteRequest

from backend.routers.trace import router as trace_router
from backend.utils.db import (
    DATABRICKS_HOST,
    TRACE_CATALOG,
    TRACE_SCHEMA,
    WAREHOUSE_HTTP_PATH,
    check_warehouse_config,
    hostname,
    resolve_token,
    run_sql_async,
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

ENABLE_DEBUG_ENDPOINTS: bool = os.environ.get("APP_ENV", "").strip().lower() == "development"
STATIC_DIR: Path = Path(__file__).parent.parent / "frontend" / "dist"

app = create_api_app(
    title="Trace2 API",
)

app.include_router(trace_router, prefix="/api", tags=["Traceability"])


@app.get("/api/health")
async def health():
    return health_payload()


@app.get("/api/ready")
async def ready():
    # Specific check for missing readiness token (needed for test expectations)
    readiness_token = os.environ.get("DATABRICKS_READINESS_TOKEN", "").strip()
    if not readiness_token:
        raise HTTPException(
            status_code=503,
            detail={
                "status": "not_ready",
                "reason": "readiness_token_missing",
                "message": "DATABRICKS_READINESS_TOKEN environment variable is not set.",
            },
        )

    # Specific check for missing warehouse config
    try:
        check_warehouse_config()
    except HTTPException:
        raise HTTPException(
            status_code=503,
            detail={
                "status": "not_ready",
                "reason": "warehouse_config_missing",
                "message": "Warehouse configuration is missing or invalid.",
            },
        )

    try:
        await databricks_sql_ready(
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
    return {"status": "ready"}


@app.get("/api/health/debug")
async def health_debug(
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    if not ENABLE_DEBUG_ENDPOINTS:
        raise HTTPException(status_code=404, detail="Not found")
    resolve_token(x_forwarded_access_token, authorization)
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


register_spa_routes(app, static_dir_getter=lambda: STATIC_DIR)
