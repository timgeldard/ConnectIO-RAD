"""
Application services for quality record queries.
"""

from shared_db.utils import attach_payload_freshness
from shared_trace.freshness_sources import TRACE2_PAGE_FRESHNESS_SOURCES

from shared_trace.domain.models import BatchIdentity
from backend.quality_record.dal.quality import (
    fetch_batch_compare,
    fetch_coa,
    fetch_mass_balance,
    fetch_production_history,
    fetch_quality,
)
from backend.utils.db import attach_data_freshness
from backend.utils.exceptions import TraceNotFound

_PAGE_SOURCES = {key: list(value) for key, value in TRACE2_PAGE_FRESHNESS_SOURCES.items()}


async def get_coa(token: str, identity: BatchIdentity, request_path: str) -> dict:
    """
    Get Certificate of Analysis for a batch.
    """
    payload = await fetch_coa(token, identity)
    if not payload.get("header"):
        raise TraceNotFound(
            f"No data for Material '{identity.material}', Batch '{identity.batch}'."
        )

    return await attach_payload_freshness(
        payload,
        token,
        request_path,
        _PAGE_SOURCES["coa"],
        attach_freshness_func=attach_data_freshness
    )


async def get_mass_balance(token: str, identity: BatchIdentity, request_path: str) -> dict:
    """
    Get mass balance history for a batch.
    """
    payload = await fetch_mass_balance(token, identity)
    if not payload.get("header"):
        raise TraceNotFound(
            f"No data for Material '{identity.material}', Batch '{identity.batch}'."
        )

    return await attach_payload_freshness(
        payload,
        token,
        request_path,
        _PAGE_SOURCES["mass_balance"],
        attach_freshness_func=attach_data_freshness
    )


async def get_quality(token: str, identity: BatchIdentity, request_path: str) -> dict:
    """
    Get quality results and lots for a batch.
    """
    payload = await fetch_quality(token, identity)
    if not payload.get("header"):
        raise TraceNotFound(
            f"No data for Material '{identity.material}', Batch '{identity.batch}'."
        )

    return await attach_payload_freshness(
        payload,
        token,
        request_path,
        _PAGE_SOURCES["quality"],
        attach_freshness_func=attach_data_freshness
    )


async def get_production_history(token: str, identity: BatchIdentity, request_path: str) -> dict:
    """
    Get production history for a material.
    """
    payload = await fetch_production_history(token, identity)
    if not payload.get("header"):
        raise TraceNotFound(
            f"No data for Material '{identity.material}', Batch '{identity.batch}'."
        )

    return await attach_payload_freshness(
        payload,
        token,
        request_path,
        _PAGE_SOURCES["production_history"],
        attach_freshness_func=attach_data_freshness
    )


async def get_batch_compare(token: str, identity: BatchIdentity, request_path: str) -> dict:
    """
    Get batch comparison data for a material.
    """
    payload = await fetch_batch_compare(token, identity)
    if not payload.get("header"):
        raise TraceNotFound(
            f"No data for Material '{identity.material}', Batch '{identity.batch}'."
        )

    return await attach_payload_freshness(
        payload,
        token,
        request_path,
        _PAGE_SOURCES["batch_compare"],
        attach_freshness_func=attach_data_freshness
    )
