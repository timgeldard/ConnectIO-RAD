"""
Data access layer for batch trace context.
"""

import os
from typing import Optional
from trace2_backend.batch_trace.dal.trace_core import get_trace_core_dal
from shared_trace.domain.models import BatchIdentity, BatchOnlyIdentity
from shared_db.errors import increment_observability_counter

MAX_TRACE_LEVELS: int = int(os.environ.get("MAX_TRACE_LEVELS", "10"))
_dal = get_trace_core_dal()


async def fetch_trace_tree(
    token: str, 
    identity: BatchIdentity, 
    max_levels: int = MAX_TRACE_LEVELS
) -> list[dict]:
    """Fetch trace tree rows from the database."""
    rows = await _dal.fetch_trace_tree(
        token, 
        identity.material, 
        identity.batch, 
        max_levels
    )
    if rows:
        increment_observability_counter("trace.found", tags={"material_id": identity.material})
    else:
        increment_observability_counter("trace.not_found", tags={"material_id": identity.material})
    return rows


async def fetch_summary(token: str, identity: BatchOnlyIdentity) -> Optional[dict]:
    """Fetch high-level batch summary."""
    res = await _dal.fetch_summary(token, identity.batch)
    if res:
        increment_observability_counter("batch.summary.found")
    return res

async def fetch_batch_details(token: str, identity: BatchIdentity) -> dict:
    """Fetch detailed batch information."""
    return await _dal.fetch_batch_details(token, identity.material, identity.batch)

async def fetch_impact(token: str, identity: BatchOnlyIdentity) -> dict:
    """Fetch impact analysis for a batch."""
    return await _dal.fetch_impact(token, identity.batch)

async def fetch_batch_header(token: str, identity: BatchIdentity) -> Optional[dict]:
    """Fetch batch header metadata."""
    return await _dal.fetch_batch_header(token, identity.material, identity.batch)
