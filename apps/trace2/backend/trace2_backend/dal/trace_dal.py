"""
Compatibility shim for Trace2 DAL.
Delegates to context-specific DAL modules.
"""

from typing import Optional

from trace2_backend.batch_trace.dal.trace import (
    MAX_TRACE_LEVELS,
    fetch_batch_details as _fetch_batch_details,
    fetch_batch_header as _fetch_batch_header,
    fetch_impact as _fetch_impact,
    fetch_summary as _fetch_summary,
    fetch_trace_tree as _fetch_trace_tree,
)
from trace2_backend.batch_trace.dal.trace_core import get_trace_core_dal
from shared_trace.domain.models import BatchIdentity, BatchOnlyIdentity
from trace2_backend.batch_trace.domain.trace_tree import build_trace_tree as build_tree_imported
from trace2_backend.lineage_analysis.dal.lineage import (
    fetch_bottom_up as _fetch_bottom_up,
    fetch_recall_readiness as _fetch_recall_readiness,
    fetch_supplier_risk as _fetch_supplier_risk,
    fetch_top_down as _fetch_top_down,
)
from trace2_backend.lineage_analysis.domain.lineage import LineageDepth
from trace2_backend.quality_record.dal.quality import (
    fetch_batch_compare as _fetch_batch_compare,
    fetch_coa as _fetch_coa,
    fetch_mass_balance as _fetch_mass_balance,
    fetch_production_history as _fetch_production_history,
    fetch_quality as _fetch_quality,
)

# Re-export for compatibility with tests that patch _trace_core_dal
_trace_core_dal = get_trace_core_dal()

# Re-export for compatibility
__all__ = [
    "MAX_TRACE_LEVELS",
    "_build_tree",
    "fetch_trace_tree",
    "fetch_summary",
    "fetch_batch_details",
    "fetch_impact",
    "fetch_recall_readiness",
    "fetch_batch_header",
    "fetch_coa",
    "fetch_mass_balance",
    "fetch_quality",
    "fetch_production_history",
    "fetch_batch_compare",
    "fetch_bottom_up",
    "fetch_top_down",
    "fetch_supplier_risk",
    "_trace_core_dal",
]

def _build_tree(rows: list[dict]) -> dict | None:
    return build_tree_imported(rows)


async def fetch_trace_tree(
    token: str,
    material_id: str,
    batch_id: str,
    max_levels: int = MAX_TRACE_LEVELS,
) -> list[dict]:
    identity = BatchIdentity.from_strings(material_id, batch_id)
    return await _fetch_trace_tree(token, identity, max_levels)


async def fetch_summary(token: str, batch_id: str) -> dict | None:
    identity = BatchOnlyIdentity.from_string(batch_id)
    return await _fetch_summary(token, identity)


async def fetch_batch_details(token: str, material_id: str, batch_id: str) -> dict:
    identity = BatchIdentity.from_strings(material_id, batch_id)
    return await _fetch_batch_details(token, identity)


async def fetch_impact(token: str, batch_id: str) -> dict:
    identity = BatchOnlyIdentity.from_string(batch_id)
    return await _fetch_impact(token, identity)


async def fetch_recall_readiness(token: str, material_id: str, batch_id: str) -> dict:
    identity = BatchIdentity.from_strings(material_id, batch_id)
    return await _fetch_recall_readiness(token, identity)


async def fetch_batch_header(token: str, material_id: str, batch_id: str) -> Optional[dict]:
    identity = BatchIdentity.from_strings(material_id, batch_id)
    return await _fetch_batch_header(token, identity)


async def fetch_coa(token: str, material_id: str, batch_id: str) -> dict:
    identity = BatchIdentity.from_strings(material_id, batch_id)
    return await _fetch_coa(token, identity)


async def fetch_mass_balance(token: str, material_id: str, batch_id: str) -> dict:
    identity = BatchIdentity.from_strings(material_id, batch_id)
    return await _fetch_mass_balance(token, identity)


async def fetch_quality(token: str, material_id: str, batch_id: str) -> dict:
    identity = BatchIdentity.from_strings(material_id, batch_id)
    return await _fetch_quality(token, identity)


async def fetch_production_history(token: str, material_id: str, batch_id: str, limit: int = 24) -> dict:
    identity = BatchIdentity.from_strings(material_id, batch_id)
    return await _fetch_production_history(token, identity, limit)


async def fetch_batch_compare(token: str, material_id: str, batch_id: str, limit: int = 24) -> dict:
    identity = BatchIdentity.from_strings(material_id, batch_id)
    return await _fetch_batch_compare(token, identity, limit)


async def fetch_bottom_up(token: str, material_id: str, batch_id: str, max_levels: int = 4) -> dict:
    identity = BatchIdentity.from_strings(material_id, batch_id)
    return await _fetch_bottom_up(token, identity, LineageDepth(max_levels))


async def fetch_top_down(token: str, material_id: str, batch_id: str, max_levels: int = 4) -> dict:
    identity = BatchIdentity.from_strings(material_id, batch_id)
    return await _fetch_top_down(token, identity, LineageDepth(max_levels))


async def fetch_supplier_risk(token: str, material_id: str, batch_id: str) -> dict:
    identity = BatchIdentity.from_strings(material_id, batch_id)
    return await _fetch_supplier_risk(token, identity)
