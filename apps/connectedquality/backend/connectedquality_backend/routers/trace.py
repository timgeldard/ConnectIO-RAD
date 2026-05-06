"""Trace module routers — returns real data from trace2_backend DALs.

Replace mock returns with DAL queries once the CQ data layer is wired.
"""

from fastapi import APIRouter, Depends

from shared_auth.identity import require_proxy_user, UserIdentity
from trace2_backend.dal.trace_dal import fetch_recall_readiness, fetch_mass_balance, fetch_bottom_up

router = APIRouter()


@router.get("/trace/recall")
async def trace_recall(material: str = "20582002", batch: str = "0008898869", user: UserIdentity = Depends(require_proxy_user)):
    """Recall readiness snapshot for the active batch."""
    token = user.raw_token
    return await fetch_recall_readiness(token, material_id=material, batch_id=batch)


@router.get("/trace/lineage")
async def trace_lineage(material: str = "20582002", batch: str = "0008898869", user: UserIdentity = Depends(require_proxy_user)):
    """Upstream/downstream lineage graph for the active batch."""
    # To satisfy the overview requirement, we fetch one side (bottom_up) to populate the nodes.
    token = user.raw_token
    lineage = await fetch_bottom_up(token, material_id=material, batch_id=batch, max_levels=3)
    return {
        "batch": batch,
        "upstream_depth": 3,
        "downstream_depth": 0,
        "nodes": lineage.get("nodes", []),
        "edges": lineage.get("edges", []),
    }


@router.get("/trace/mass-balance")
async def trace_mass_balance(material: str = "20582002", batch: str = "0008898869", user: UserIdentity = Depends(require_proxy_user)):
    """Mass balance summary for the active batch."""
    token = user.raw_token
    return await fetch_mass_balance(token, material_id=material, batch_id=batch)
