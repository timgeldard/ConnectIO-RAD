"""Domain — heatmap and lot status derivation rules."""

from typing import Literal, Optional

from backend.inspection_analysis.domain.valuation import ACCEPT_VALUATIONS, REJECT_VALUATIONS, normalize_valuation

DerivedLocationStatus = Literal["PASS", "FAIL", "WARNING"]
LotStatus = Literal["PASS", "FAIL", "PENDING", "NO_DATA"]
LocationStatus = Literal["PASS", "FAIL", "PENDING", "NO_DATA", "WARNING"]


def derive_location_status(
    loc_rows: list[dict],
    risk: float,
    continuous_mode: bool,
    early_warning: bool,
) -> DerivedLocationStatus:
    """Derive a marker status from result rows, risk score, mode, and SPC flag.

    Deterministic mode: latest valuation only. Continuous mode: risk score thresholds
    with hard override for any active rejection. Early warning escalates PASS to WARNING.

    Args:
        loc_rows: Result rows for one location, ordered by the DAL.
        risk: Continuous risk score for the same location.
        continuous_mode: Whether risk thresholds should be used.
        early_warning: Whether SPC early-warning logic flagged the location.

    Returns:
        Derived marker status for the heatmap.
    """
    latest = loc_rows[-1] if loc_rows else {}
    l_val = normalize_valuation(latest.get("valuation"))

    if not continuous_mode:
        status: DerivedLocationStatus = "FAIL" if l_val in REJECT_VALUATIONS else "PASS"
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


def lot_status(valuation: Optional[str], end_date) -> LotStatus:
    """Derive lot-level status from its aggregate valuation and end date.

    Args:
        valuation: Aggregate lot valuation value.
        end_date: Inspection end date; missing values indicate pending lots.

    Returns:
        Lot-level status value for API response mapping.
    """
    if end_date is None:
        return "PENDING"
    v = normalize_valuation(valuation)
    if v in REJECT_VALUATIONS:
        return "FAIL"
    if v in ACCEPT_VALUATIONS:
        return "PASS"
    return "NO_DATA"
