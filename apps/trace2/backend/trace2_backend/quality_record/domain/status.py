"""Domain logic for quality status classification.

This module provides functions to normalize raw quality statuses and derive
batch-level statuses from stock quantities and inspection results.
"""

from typing import Literal


QualityStatus = Literal["ACCEPTED", "REJECTED", "PENDING", "UNKNOWN"]


def normalize_quality_status(value: str | None) -> QualityStatus:
    """Normalize a raw quality status string into a canonical domain QualityStatus.

    Maps various SAP and system-specific status codes (e.g., 'RELEASED', 'BLOCKED',
    'QI HOLD') to a unified domain representation.

    Args:
        value: The raw status string to normalize. Can be None.

    Returns:
        The normalized QualityStatus ('ACCEPTED', 'REJECTED', 'PENDING', or 'UNKNOWN').

    Raises:
        None explicitly. Returns 'UNKNOWN' for unrecognized or empty inputs.
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
    """Determine a batch status based on stock levels and quality metrics.

    Implements the business policy for classifying a batch as 'Blocked',
    'QI Hold', or 'Released' based on the presence of blocked stock,
    quality inspection stock, restricted stock, or failed quality tests.

    Args:
        blocked_qty: Quantity of stock that is currently blocked.
        qi_qty: Quantity of stock currently in Quality Inspection.
        restricted_qty: Quantity of stock that is restricted.
        rejected_results: Number of rejected quality inspection results.
            Defaults to 0.
        failed_mics: Number of failed Master Inspection Characteristics.
            Defaults to 0.

    Returns:
        A string representing the batch status: 'Blocked', 'QI Hold',
        or 'Released'.

    Raises:
        None explicitly.
    """
    if blocked_qty > 0 or rejected_results > 0:
        return "Blocked"
    if qi_qty > 0 or failed_mics > 0 or restricted_qty > 0:
        return "QI Hold"
    return "Released"
