"""Trace module stub routers — returns mock data matching the handoff shape.

Replace mock returns with DAL queries once the CQ data layer is wired.
"""

from fastapi import APIRouter

router = APIRouter()


@router.get("/trace/recall")
async def trace_recall():
    """Recall readiness snapshot for the active batch."""
    return {
        "batch": "0008898869",
        "material": "20582002",
        "status": "QI_HOLD",
        "customers_affected": 11,
        "countries_affected": 8,
        "total_shipped_kg": 15030.0,
        "deliveries": 42,
    }


@router.get("/trace/lineage")
async def trace_lineage():
    """Upstream/downstream lineage graph for the active batch."""
    return {
        "batch": "0008898869",
        "upstream_depth": 3,
        "downstream_depth": 2,
        "nodes": [],
        "edges": [],
    }


@router.get("/trace/mass-balance")
async def trace_mass_balance():
    """Mass balance summary for the active batch."""
    return {
        "batch": "0008898869",
        "input_kg": 12820.0,
        "output_kg": 12400.0,
        "variance_kg": 420.0,
        "variance_pct": 3.28,
    }
