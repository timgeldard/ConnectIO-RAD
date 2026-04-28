import os
from pathlib import Path
from typing import Optional

from fastapi import Depends, Header
from backend.routers.exclusions import router as exclusions_router
from backend.routers.export import router as export_router
from backend.routers.genie import router as genie_router
from backend.routers.spc_analysis import router as spc_analysis_router
from backend.routers.spc_charts import router as spc_charts_router
from backend.routers.spc_metadata import router as spc_metadata_router
from backend.routers.trace import router as trace_router
from backend.utils.db import (
    DATABRICKS_HOST,
    TRACE_CATALOG,
    TRACE_SCHEMA,
    WAREHOUSE_HTTP_PATH,
    check_warehouse_config,
    run_sql,
    run_sql_async,
)
from backend.utils.schema_contract import assert_gold_view_schema
from shared_api import (
    create_api_app,
    health_payload,
    register_spa_routes,
    databricks_sql_ready,
)
from shared_api.security import require_token, resolve_token
from shared_db.errors import send_operational_alert

ENABLE_DEBUG_ENDPOINTS: bool = os.environ.get("APP_ENV", "").strip().lower() == "development"
STATIC_DIR: Path = Path(__file__).parent.parent / "frontend" / "dist"
LATENCY_BUDGETS_MS = {
    "/api/spc/scorecard": 8_000,
    "/api/spc/chart-data": 5_000,
    "/api/spc/characteristics": 3_000,
    "/api/spc/materials": 2_000,
}

app = create_api_app(
    title="TraceApp API",
    latency_budgets_ms=LATENCY_BUDGETS_MS,
    latency_alert_callback=lambda path, dur, bud, status: send_operational_alert(
        subject="Latency budget exceeded",
        body=f"Request to {path} completed in {dur} ms (budget {bud} ms, status {status}).",
        request_path=path,
    ),
)

app.include_router(trace_router, prefix="/api", tags=["Traceability"])
app.include_router(spc_metadata_router, prefix="/api/spc", tags=["SPC"])
app.include_router(spc_charts_router, prefix="/api/spc", tags=["SPC"])
app.include_router(spc_analysis_router, prefix="/api/spc", tags=["SPC"])
app.include_router(export_router, prefix="/api/spc", tags=["SPC Export"])
app.include_router(exclusions_router, prefix="/api/spc", tags=["SPC Exclusions"])
app.include_router(genie_router, prefix="/api/spc", tags=["Genie"])


@app.get("/api/health")
async def health():
    return health_payload()


@app.get("/api/ready")
async def ready():
    # We still need a custom ready for SPC because it also checks gold_view_schema drift
    await databricks_sql_ready(
        check_warehouse_config=check_warehouse_config,
        run_sql=run_sql_async,
    )
    
    readiness_token = os.environ.get("DATABRICKS_READINESS_TOKEN", "").strip()
    schema_result = await assert_gold_view_schema(
        readiness_token,
        TRACE_CATALOG,
        TRACE_SCHEMA,
    )
    if not schema_result.ok:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=503,
            detail={
                "status": "not_ready",
                "reason": "gold_view_schema_drift",
                "message": (
                    "Gold view schema has drifted from the frozen contract. "
                    "Update backend/schema/gold_views.v1.json after reconciling with the upstream team."
                ),
                "schema_check": schema_result.as_dict(),
            },
        )

    return {
        "status": "ready",
        "checks": {
            "config": "ok",
            "sql_warehouse": "ok",
            "gold_view_schema": "ok",
        },
        "schema_contract_version": schema_result.version,
    }


@app.get("/api/health/debug")
async def health_debug(
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    if not ENABLE_DEBUG_ENDPOINTS:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Not found")
    
    resolve_token(x_forwarded_access_token, authorization)
    
    return {
        "status": "ok",
        "databricks_host": DATABRICKS_HOST[:50] if DATABRICKS_HOST else "(NOT SET)",
        "warehouse_http_path": WAREHOUSE_HTTP_PATH if WAREHOUSE_HTTP_PATH else "(NOT SET)",
        "trace_catalog": TRACE_CATALOG,
        "trace_schema": TRACE_SCHEMA,
        "static_dir_exists": STATIC_DIR.exists(),
        "python_version": __import__("sys").version,
    }


@app.get("/api/test-query")
async def test_query(
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    if not ENABLE_DEBUG_ENDPOINTS:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Not found")
    
    token = resolve_token(x_forwarded_access_token, authorization)
    
    info: dict = {"token_present": True, "token_length": len(token)}
    try:
        info["result"] = run_sql(token, "SELECT 1 AS ok")
        info["status"] = "ok"
    except Exception as exc:
        info["status"] = "error"
        info["error"] = str(exc)[:500]
    return info


register_spa_routes(app, static_dir_getter=lambda: STATIC_DIR)
