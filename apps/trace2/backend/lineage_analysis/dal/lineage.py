"""
Data access layer for lineage analysis context.
"""

from backend.batch_trace.dal.trace_core import get_trace_core_dal
from backend.batch_trace.domain.identity import BatchIdentity
from backend.lineage_analysis.domain.lineage import LineageDepth

_dal = get_trace_core_dal()

async def fetch_recall_readiness(token: str, identity: BatchIdentity) -> dict:
    """Fetch recall readiness report for a batch."""
    return await _dal.fetch_recall_readiness(token, identity.material, identity.batch)

async def fetch_bottom_up(
    token: str, 
    identity: BatchIdentity, 
    depth: LineageDepth = LineageDepth(4)
) -> dict:
    """Fetch bottom-up lineage."""
    return await _dal.fetch_bottom_up(token, identity.material, identity.batch, int(depth))

async def fetch_top_down(
    token: str, 
    identity: BatchIdentity, 
    depth: LineageDepth = LineageDepth(4)
) -> dict:
    """Fetch top-down lineage."""
    return await _dal.fetch_top_down(token, identity.material, identity.batch, int(depth))

async def fetch_supplier_risk(token: str, identity: BatchIdentity) -> dict:
    """Fetch supplier risk analysis."""
    return await _dal.fetch_supplier_risk(token, identity.material, identity.batch)
