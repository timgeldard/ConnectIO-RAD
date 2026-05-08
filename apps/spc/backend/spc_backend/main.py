import logging
import os
from pathlib import Path

from spc_backend.chart_config.router import router as chart_config_router
from spc_backend.process_control.router_analysis import router as spc_analysis_router
from spc_backend.process_control.router_charts import router as spc_charts_router
from spc_backend.process_control.router_metadata import router as spc_metadata_router
from spc_backend.routers.export import router as export_router
from spc_backend.routers.genie import router as genie_router
from spc_backend.routers.trace import router as trace_router
from spc_backend.utils.db import (
    DATABRICKS_HOST,
    TRACE_CATALOG,
    TRACE_SCHEMA,
    WAREHOUSE_HTTP_PATH,
    check_warehouse_config,
    run_sql,
    run_sql_async,
)
from spc_backend.utils.schema_contract import assert_gold_view_schema
from shared_api import ConnectIoApp, databricks_sql_ready
from shared_auth import UserIdentity
from shared_db.errors import send_operational_alert

logger = logging.getLogger(__name__)

STATIC_DIR: Path = Path(__file__).parent.parent / "frontend" / "dist"
LATENCY_BUDGETS_MS = {
    "/api/spc/scorecard": 8_000,
    "/api/spc/chart-data": 5_000,
    "/api/spc/characteristics": 3_000,
    "/api/spc/materials": 2_000,
}
DEFAULT_LATENCY_BUDGET_MS = 10_000


def _latency_budget_ms_for_path(path: str) -> int:
    """Return the configured latency budget for ``path``, or the default.

    Mirror of the lookup the LatencyMiddleware does internally; exposed
    here so tests can verify the SPC-specific budget map without reaching
    into middleware internals.
    """
    return LATENCY_BUDGETS_MS.get(path, DEFAULT_LATENCY_BUDGET_MS)


async def spc_readiness_check() -> dict:
    """Readiness probe logic — verifies warehouse connectivity and gold view schema."""
    from fastapi import HTTPException

    # 1. Base Databricks SQL connectivity check
    try:
        await databricks_sql_ready(
            check_warehouse_config=check_warehouse_config,
            run_sql=run_sql_async,
        )
    except HTTPException as exc:
        # Re-wrap to ensure the specific structure expected by SPC unit tests
        raise HTTPException(
            status_code=exc.status_code,
            detail={
                "reason": "sql_warehouse_unreachable",
                "message": "An internal error occurred while reaching the SQL warehouse.",
                "error": str(exc.detail),
            },
        )

    # 2. Gold View Schema Contract assertion
    readiness_token = os.environ.get("DATABRICKS_READINESS_TOKEN", "").strip()
    schema_result = await assert_gold_view_schema(
        readiness_token,
        TRACE_CATALOG,
        TRACE_SCHEMA,
    )
    if not schema_result.ok:
        raise HTTPException(
            status_code=503,
            detail={
                "status": "not_ready",
                "reason": "gold_view_schema_drift",
                "message": (
                    "Gold view schema has drifted from the frozen contract. "
                    "Update spc_backend/schemas/gold_views.v1.json after reconciling with the upstream team."
                ),
                "schema_check": schema_result.as_dict(),
            },
        )

    return {
        "checks": {"config": "ok", "sql_warehouse": "ok", "gold_view_schema": "ok"},
        "schema_contract_version": schema_result.version,
    }


async def spc_debug_config(_user: UserIdentity) -> dict:
    """Runtime configuration summary for debugging."""
    return {
        "status": "ok",
        "databricks_host": DATABRICKS_HOST[:50] if DATABRICKS_HOST else "(NOT SET)",
        "warehouse_http_path": WAREHOUSE_HTTP_PATH if WAREHOUSE_HTTP_PATH else "(NOT SET)",
        "trace_catalog": TRACE_CATALOG,
        "trace_schema": TRACE_SCHEMA,
        "static_dir_exists": STATIC_DIR.exists(),
        "python_version": __import__("sys").version,
    }


async def spc_test_query(user: UserIdentity) -> dict:
    """Lightweight SQL execution test."""
    token = user.raw_token
    info: dict = {"token_present": True, "token_length": len(token)}
    try:
        info["result"] = run_sql(token, "SELECT 1 AS ok")
        info["status"] = "ok"
    except Exception as exc:
        info["status"] = "error"
        info["error"] = str(exc)[:500]
    return info


# Bootstrap the application using the ConnectIO framework
rad_app = ConnectIoApp(
    title="SPC API",
    static_dir=STATIC_DIR,
    latency_budgets_ms=LATENCY_BUDGETS_MS,
    latency_alert_callback=lambda path, dur, bud, status: send_operational_alert(
        subject="Latency budget exceeded",
        body=f"Request to {path} completed in {dur} ms (budget {bud} ms, status {status}).",
        request_path=path,
    ),
    readiness_checks=[spc_readiness_check],
    debug_config=spc_debug_config,
    test_query_runner=spc_test_query,
)

# Domain Router Registration — must happen BEFORE mount_spa() / fastapi_app
# access, because the SPA catch-all would otherwise shadow these routes.
rad_app.include_router(trace_router, prefix="/api", tags=["Traceability"])
rad_app.include_router(spc_metadata_router, prefix="/api/spc", tags=["SPC"])
rad_app.include_router(spc_charts_router, prefix="/api/spc", tags=["SPC"])
rad_app.include_router(spc_analysis_router, prefix="/api/spc", tags=["SPC"])
rad_app.include_router(export_router, prefix="/api/spc", tags=["SPC Export"])
rad_app.include_router(chart_config_router, prefix="/api/spc", tags=["SPC Chart Config"])
rad_app.include_router(genie_router, prefix="/api/spc", tags=["Genie"])

rad_app.mount_spa()
app = rad_app.fastapi_app
