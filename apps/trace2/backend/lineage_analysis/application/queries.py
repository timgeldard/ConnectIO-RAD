"""
Application services for lineage analysis queries.
"""

from shared_db.utils import attach_payload_freshness
from shared_trace.freshness_sources import TRACE2_PAGE_FRESHNESS_SOURCES

from shared_trace.domain.models import BatchIdentity
from backend.lineage_analysis.dal.lineage import (
    fetch_bottom_up,
    fetch_recall_readiness,
    fetch_supplier_risk,
    fetch_top_down,
)
from backend.lineage_analysis.domain.lineage import LineageDepth
from backend.utils.db import attach_data_freshness
from backend.utils.exceptions import TraceNotFound

_PAGE_SOURCES = {key: list(value) for key, value in TRACE2_PAGE_FRESHNESS_SOURCES.items()}


async def get_recall_readiness(token: str, identity: BatchIdentity, request_path: str) -> dict:
    """
    Get recall readiness report for a batch.
    """
    payload = await fetch_recall_readiness(token, identity)
    if not payload.get("header"):
        raise TraceNotFound(
            f"No data for Material '{identity.material}', Batch '{identity.batch}'."
        )

    return await attach_payload_freshness(
        payload,
        token,
        request_path,
        [
            "gold_batch_lineage",
            "gold_batch_stock_mat",
            "gold_batch_mass_balance_mat",
            "gold_batch_delivery_mat",
            "gold_batch_summary_v",
            "gold_plant",
        ],
        attach_freshness_func=attach_data_freshness
    )


async def get_bottom_up(
    token: str, 
    identity: BatchIdentity, 
    request_path: str,
    depth: LineageDepth = LineageDepth(4)
) -> dict:
    """
    Get bottom-up lineage analysis.
    """
    payload = await fetch_bottom_up(token, identity, depth)
    if not payload.get("header"):
        raise TraceNotFound(
            f"No data for Material '{identity.material}', Batch '{identity.batch}'."
        )

    return await attach_payload_freshness(
        payload,
        token,
        request_path,
        _PAGE_SOURCES["bottom_up"],
        attach_freshness_func=attach_data_freshness
    )


async def get_top_down(
    token: str, 
    identity: BatchIdentity, 
    request_path: str,
    depth: LineageDepth = LineageDepth(4)
) -> dict:
    """
    Get top-down lineage analysis.
    """
    payload = await fetch_top_down(token, identity, depth)
    if not payload.get("header"):
        raise TraceNotFound(
            f"No data for Material '{identity.material}', Batch '{identity.batch}'."
        )

    return await attach_payload_freshness(
        payload,
        token,
        request_path,
        _PAGE_SOURCES["top_down"],
        attach_freshness_func=attach_data_freshness
    )


async def get_supplier_risk(token: str, identity: BatchIdentity, request_path: str) -> dict:
    """
    Get supplier risk analysis.
    """
    payload = await fetch_supplier_risk(token, identity)
    if not payload.get("header"):
        raise TraceNotFound(
            f"No data for Material '{identity.material}', Batch '{identity.batch}'."
        )

    return await attach_payload_freshness(
        payload,
        token,
        request_path,
        _PAGE_SOURCES["supplier_risk"],
        attach_freshness_func=attach_data_freshness
    )
