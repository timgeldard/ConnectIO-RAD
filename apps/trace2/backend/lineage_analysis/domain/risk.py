"""
Domain logic for risk analysis.
"""

from typing import Literal


ExposureRisk = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]


def normalize_risk(value: str | None) -> ExposureRisk:
    """
    Normalize raw risk string into a domain ExposureRisk.
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
    """
    Calculate supplier risk score based on performance metrics.
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
