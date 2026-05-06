"""Trace module routers."""

from fastapi import APIRouter, Depends, Query
import asyncio

from shared_auth.identity import require_proxy_user, UserIdentity
from connectedquality_backend.application.trace import (
    fetch_bottom_up,
    fetch_mass_balance,
    fetch_recall_readiness,
    fetch_top_down,
)

router = APIRouter()


@router.get("/trace/recall")
async def trace_recall(
    material: str = Query(..., description="Material selected by the user/session/deep link."),
    batch: str = Query(..., description="Batch selected by the user/session/deep link."),
    user: UserIdentity = Depends(require_proxy_user),
):
    """Recall readiness snapshot for the active batch."""
    token = user.raw_token
    return await fetch_recall_readiness(token, material_id=material, batch_id=batch)


@router.get("/trace/lineage")
async def trace_lineage(
    material: str = Query(..., description="Material selected by the user/session/deep link."),
    batch: str = Query(..., description="Batch selected by the user/session/deep link."),
    user: UserIdentity = Depends(require_proxy_user),
):
    """Upstream and downstream lineage graph for the active batch."""
    token = user.raw_token
    bottom_up, top_down = await asyncio.gather(
        fetch_bottom_up(token, material_id=material, batch_id=batch, max_levels=3),
        fetch_top_down(token, material_id=material, batch_id=batch, max_levels=3)
    )
    
    # Merge nodes and edges, deduplicating by ID
    nodes_map = {n["id"]: n for n in bottom_up.get("nodes", []) + top_down.get("nodes", [])}
    edges_map = {e["id"]: e for e in bottom_up.get("edges", []) + top_down.get("edges", [])}

    return {
        "batch": batch,
        "upstream_depth": bottom_up.get("max_depth", 3),
        "downstream_depth": top_down.get("max_depth", 3),
        "nodes": list(nodes_map.values()),
        "edges": list(edges_map.values()),
    }


@router.get("/trace/mass-balance")
async def trace_mass_balance(
    material: str = Query(..., description="Material selected by the user/session/deep link."),
    batch: str = Query(..., description="Batch selected by the user/session/deep link."),
    user: UserIdentity = Depends(require_proxy_user),
):
    """Mass balance summary for the active batch."""
    token = user.raw_token
    return await fetch_mass_balance(token, material_id=material, batch_id=batch)
