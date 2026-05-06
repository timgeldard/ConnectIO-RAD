"""Domain logic for status derivation.

This module contains rules for deriving location and lot-level statuses
based on inspection results, risk scores, and operational modes.
"""

from typing import Any, Literal, Optional

from envmon_backend.inspection_analysis.domain.valuation import ACCEPT_VALUATIONS, REJECT_VALUATIONS, normalize_valuation

DerivedLocationStatus = Literal["PASS", "FAIL", "WARNING"]
LotStatus = Literal["PASS", "FAIL", "PENDING", "NO_DATA"]
LocationStatus = Literal["PASS", "FAIL", "PENDING", "NO_DATA", "WARNING"]


def derive_location_status(
    loc_rows: list[dict],
    risk: float,
    continuous_mode: bool,
    early_warning: bool,
) -> LocationStatus:
    """Derive a marker status from result rows, risk score, mode, and SPC flag.

    In deterministic mode, the status is based solely on the latest valuation.
    In continuous mode, the status is determined by risk score thresholds,
    with a hard override if the latest valuation is a rejection.
    The early warning flag can escalate a 'PASS' status to 'WARNING'.

    Args:
        loc_rows: A list of result rows for one location, typically ordered
            by date (latest last).
        risk: The calculated continuous risk score for the location.
        continuous_mode: Boolean flag indicating if risk-based continuous
            monitoring logic should be applied.
        early_warning: Boolean flag indicating if SPC (Statistical Process
            Control) logic has triggered an early warning.

    Returns:
        The derived status: 'PASS', 'FAIL', 'WARNING', or 'NO_DATA'.
    """
    # If no inspection results exist, we return 'NO_DATA' rather than 'PASS'
    # to avoid statistically misleading visuals on the heatmap.
    if not loc_rows:
        return "NO_DATA"

    latest = loc_rows[-1]
    l_val = normalize_valuation(latest.get("valuation"))

    if not continuous_mode:
        status: LocationStatus = "FAIL" if l_val in REJECT_VALUATIONS else "PASS"
    else:
        status = "PASS"
        if risk > 1.0:
            status = "WARNING"
        if risk > 5.0:
            status = "FAIL"
        if l_val in REJECT_VALUATIONS:
            status = "FAIL"

    if early_warning and status == "PASS":
        status = "WARNING"

    return status


def lot_status(valuation: Optional[str], end_date: Any) -> LotStatus:
    """Derive lot-level status from its aggregate valuation and end date.

    Determines if a lot is 'PASS', 'FAIL', 'PENDING' (if not finished),
    or 'NO_DATA' (if valuation is unknown).

    Args:
        valuation: The aggregate valuation string from the inspection lot.
        end_date: The inspection end date. If None, the lot is considered PENDING.

    Returns:
        The derived lot status: 'PASS', 'FAIL', 'PENDING', or 'NO_DATA'.

    Raises:
        None explicitly, but handles unexpected valuation strings gracefully.
    """
    if end_date is None:
        return "PENDING"
    v = normalize_valuation(valuation)
    if v in REJECT_VALUATIONS:
        return "FAIL"
    if v in ACCEPT_VALUATIONS:
        return "PASS"
    return "NO_DATA"
