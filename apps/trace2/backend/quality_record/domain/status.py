"""
Domain logic for quality status.
"""

from typing import Literal


QualityStatus = Literal["ACCEPTED", "REJECTED", "PENDING", "UNKNOWN"]


def normalize_quality_status(value: str | None) -> QualityStatus:
    """
    Normalize raw quality status string into a domain QualityStatus.
    """
    if not value:
        return "UNKNOWN"
    
    upper_val = value.upper()
    if upper_val in ["A", "ACCEPTED", "RELEASED", "UNRESTRICTED"]:
        return "ACCEPTED"
    if upper_val in ["R", "REJECTED", "BLOCKED"]:
        return "REJECTED"
    if upper_val in ["P", "PENDING", "QI HOLD", "QUALITY_INSPECTION", "RESTRICTED"]:
        return "PENDING"
    
    return "UNKNOWN"


def batch_status_from_quality_stock(
    blocked_qty: float,
    qi_qty: float,
    restricted_qty: float,
    rejected_results: int = 0,
    failed_mics: int = 0
) -> str:
    """
    Business policy for determining batch status from stock and quality metrics.
    Replicates current SQL logic in a domain-pure function.
    """
    if blocked_qty > 0 or rejected_results > 0:
        return "Blocked"
    if qi_qty > 0 or failed_mics > 0 or restricted_qty > 0:
        return "QI Hold"
    return "Released"
