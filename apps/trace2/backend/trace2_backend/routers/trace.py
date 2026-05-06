"""
Compatibility shim for Trace2 routers.
Combines context-specific routers into a single router for backward compatibility.
"""

from fastapi import APIRouter
from trace2_backend.utils.db import check_warehouse_config  # noqa: F401
from trace2_backend.utils.db import attach_payload_freshness  # noqa: F401
from trace2_backend.dal.trace_dal import (
    _build_tree,  # noqa: F401
    fetch_trace_tree,  # noqa: F401
    fetch_summary,  # noqa: F401
    fetch_batch_details,  # noqa: F401
    fetch_impact,  # noqa: F401
    fetch_batch_header,  # noqa: F401
    fetch_coa,  # noqa: F401
    fetch_mass_balance,  # noqa: F401
    fetch_quality,  # noqa: F401
    fetch_production_history,  # noqa: F401
    fetch_batch_compare,  # noqa: F401
    fetch_bottom_up,  # noqa: F401
    fetch_top_down,  # noqa: F401
    fetch_supplier_risk,  # noqa: F401
    fetch_recall_readiness,  # noqa: F401
)
from trace2_backend.batch_trace.router import router as batch_trace_router
from trace2_backend.lineage_analysis.router import router as lineage_router
from trace2_backend.quality_record.router import router as quality_router

router = APIRouter()

router.include_router(batch_trace_router)
router.include_router(lineage_router)
router.include_router(quality_router)
