"""
Data access layer for quality record context.
"""

from backend.batch_trace.dal.trace_core import get_trace_core_dal
from shared_trace.domain.models import BatchIdentity

_dal = get_trace_core_dal()

async def fetch_coa(token: str, identity: BatchIdentity) -> dict:
    """Fetch Certificate of Analysis."""
    return await _dal.fetch_coa(token, identity.material, identity.batch)

async def fetch_mass_balance(token: str, identity: BatchIdentity) -> dict:
    """Fetch mass balance events."""
    return await _dal.fetch_mass_balance(token, identity.material, identity.batch)

async def fetch_quality(token: str, identity: BatchIdentity) -> dict:
    """Fetch quality inspection results and lots."""
    return await _dal.fetch_quality(token, identity.material, identity.batch)

async def fetch_production_history(token: str, identity: BatchIdentity, limit: int = 24) -> dict:
    """Fetch production history for a material."""
    return await _dal.fetch_production_history(token, identity.material, identity.batch, limit)

async def fetch_batch_compare(token: str, identity: BatchIdentity, limit: int = 24) -> dict:
    """Fetch batch comparison data."""
    return await _dal.fetch_batch_compare(token, identity.material, identity.batch, limit)
