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
    limiter=limiter,
    rate_limit_exception=RateLimitExceeded,
    rate_limit_handler=rate_limit_handler,
    slowapi_middleware=SlowAPIMiddleware,
)

app.include_router(trace_router, prefix="/api", tags=["Traceability"])


@app.exception_handler(Exception)
async def global_exception_handler(request: StarletteRequest, exc: Exception):
    return await safe_global_exception_response(request, exc, logger_name=__name__)


@app.get("/api/health")
async def health():
    return health_payload()


@app.get("/api/ready")
async def ready():
    return await databricks_sql_ready(
        check_warehouse_config=check_warehouse_config,
        run_sql=run_sql_async,
        include_sample_result=True,
        readiness_token_message=(
            "DATABRICKS_READINESS_TOKEN is not configured. "
            "A dedicated workspace token is required for SQL warehouse readiness checks."
        ),
        sql_error_message="An internal error occurred while reaching the SQL warehouse.",
    )


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
