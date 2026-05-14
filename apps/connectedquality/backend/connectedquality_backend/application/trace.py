"""Application adapters for ConnectedQuality trace summaries."""

from connectedquality_backend.db import get_trace_core_dal


async def fetch_recall_readiness(token: str, material_id: str, batch_id: str) -> dict:
    """Fetch recall readiness snapshot for a material/batch pair."""
    return await get_trace_core_dal().fetch_recall_readiness(token, material_id, batch_id)


async def fetch_bottom_up(token: str, material_id: str, batch_id: str, max_levels: int = 4) -> dict:
    """Fetch upstream lineage for a batch."""
    return await get_trace_core_dal().fetch_bottom_up(token, material_id, batch_id, max_levels)


async def fetch_top_down(token: str, material_id: str, batch_id: str, max_levels: int = 4) -> dict:
    """Fetch downstream lineage for a batch."""
    return await get_trace_core_dal().fetch_top_down(token, material_id, batch_id, max_levels)


async def fetch_mass_balance(token: str, material_id: str, batch_id: str) -> dict:
    """Fetch mass balance summary for a batch."""
    return await get_trace_core_dal().fetch_mass_balance(token, material_id, batch_id)
