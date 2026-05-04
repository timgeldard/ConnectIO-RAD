"""
Compatibility shim for Trace2 routers.
Combines context-specific routers into a single router for backward compatibility.
"""

from fastapi import APIRouter
from backend.utils.db import check_warehouse_config
from shared_db.utils import attach_payload_freshness
from backend.dal.trace_dal import (
    _build_tree,
    fetch_trace_tree,
    fetch_summary,
    fetch_batch_details,
    fetch_impact,
    fetch_batch_header,
    fetch_coa,
    fetch_mass_balance,
    fetch_quality,
    fetch_production_history,
    fetch_batch_compare,
    fetch_bottom_up,
    fetch_top_down,
    fetch_supplier_risk,
    fetch_recall_readiness,
)
from backend.batch_trace.router import router as batch_trace_router
from backend.lineage_analysis.router import router as lineage_router
from backend.quality_record.router import router as quality_router

router = APIRouter()

router.include_router(batch_trace_router)
router.include_router(lineage_router)
router.include_router(quality_router)
