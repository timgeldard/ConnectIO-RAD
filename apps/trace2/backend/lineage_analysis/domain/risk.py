"""Domain logic for risk analysis in product lineage.

This module provides utilities to categorize and calculate risk exposure
for materials and suppliers based on historical performance and failure rates.
"""

from typing import Literal


ExposureRisk = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]


def normalize_risk(value: str | None) -> ExposureRisk:
    """Normalize a raw risk string into a standard domain ExposureRisk.

    Converts various risk labels (e.g., 'VERY HIGH') into the canonical
    domain-specific risk levels used for lineage analysis.

    Args:
        value: The raw risk string to normalize. Can be None.

    Returns:
        The normalized ExposureRisk level ('LOW', 'MEDIUM', 'HIGH', or 'CRITICAL').

    Raises:
        None explicitly. Default is 'LOW' for unknown or empty input.
    """
    if not value:
        return "LOW"
    
    upper_val = value.upper()
    if upper_val in ["CRITICAL", "VERY HIGH"]:
        return "CRITICAL"
    if upper_val == "HIGH":
        return "HIGH"
    if upper_val == "MEDIUM":
        return "MEDIUM"
    return "LOW"


def supplier_risk_score(
    rejected_batches: int, 
    total_batches: int, 
    late_or_blocked: int = 0
) -> ExposureRisk:
    """Calculate supplier risk score based on performance metrics.

    Evaluates the risk level of a supplier by considering the ratio of
    rejected or late/blocked batches relative to the total number of batches.

    Args:
        rejected_batches: The count of batches that failed quality inspection.
        total_batches: The total number of batches received from the supplier.
        late_or_blocked: The count of batches that were either delivered late
            or blocked for non-quality reasons. Defaults to 0.

    Returns:
        The calculated ExposureRisk level.

    Raises:
        ZeroDivisionError: If total_batches is handled improperly (though
            guarded against in implementation).
    """
    if total_batches <= 0:
        return "LOW"
    
    failure_rate = (rejected_batches + late_or_blocked) / total_batches
    
    if failure_rate > 0.5 or rejected_batches > 10:
        return "CRITICAL"
    if failure_rate > 0.2:
        return "HIGH"
    if failure_rate > 0.05:
        return "MEDIUM"
    return "LOW"
