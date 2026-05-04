"""
Application services for batch trace queries.
"""

from shared_db.utils import attach_payload_freshness
from shared_trace.freshness_sources import (
    BATCH_DETAILS_FRESHNESS_SOURCES,
    IMPACT_FRESHNESS_SOURCES,
    SUMMARY_FRESHNESS_SOURCES,
    TRACE_TREE_FRESHNESS_SOURCES,
)

from backend.batch_trace.dal.trace import (
    fetch_batch_details,
    fetch_batch_header,
    fetch_impact,
    fetch_summary,
    fetch_trace_tree,
)
from backend.batch_trace.domain.identity import BatchIdentity, BatchOnlyIdentity
from backend.batch_trace.domain.trace_tree import build_trace_tree
from backend.utils.db import attach_data_freshness
from backend.utils.exceptions import TraceNotFound


async def get_trace_tree(token: str, identity: BatchIdentity, request_path: str) -> dict:
    """
    Get the full traceability tree for a batch.
    """
    rows = await fetch_trace_tree(token, identity)
    if not rows:
        raise TraceNotFound(
            f"No traceability data found for Material '{identity.material}', Batch '{identity.batch}'."
        )

    payload = {"tree": build_trace_tree(rows), "total_nodes": len(rows)}
    return await attach_payload_freshness(
        payload,
        token,
        request_path,
        list(TRACE_TREE_FRESHNESS_SOURCES),
        attach_freshness_func=attach_data_freshness
    )


async def get_summary(token: str, identity: BatchOnlyIdentity, request_path: str) -> dict:
    """
    Get a high-level inventory and mass-balance summary for a batch.
    """
    payload = await fetch_summary(token, identity)
    if not payload:
        raise TraceNotFound(f"No summary data for Batch '{identity.batch}'.")

    return await attach_payload_freshness(
        payload,
        token,
        request_path,
        list(SUMMARY_FRESHNESS_SOURCES),
        attach_freshness_func=attach_data_freshness
    )


async def get_batch_details(token: str, identity: BatchIdentity, request_path: str) -> dict:
    """
    Get detailed metrics and exposure risk for a batch.
    """
    payload = await fetch_batch_details(token, identity)
    if not payload.get("summary"):
        raise TraceNotFound(f"No data for Batch '{identity.batch}'.")

    return await attach_payload_freshness(
        payload,
        token,
        request_path,
        list(BATCH_DETAILS_FRESHNESS_SOURCES),
        attach_freshness_func=attach_data_freshness
    )


async def get_impact(token: str, identity: BatchOnlyIdentity, request_path: str) -> dict:
    """
    Get downstream customer and peer batch exposure.
    """
    payload = await fetch_impact(token, identity)
    return await attach_payload_freshness(
        payload,
        token,
        request_path,
        list(IMPACT_FRESHNESS_SOURCES),
        attach_freshness_func=attach_data_freshness
    )


async def get_batch_header(token: str, identity: BatchIdentity) -> dict:
    """
    Get core identity and status header for a batch.
    """
    row = await fetch_batch_header(token, identity)
    if not row:
        raise TraceNotFound(
            f"No data for Material '{identity.material}', Batch '{identity.batch}'."
        )
    return row
