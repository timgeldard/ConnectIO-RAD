"""Domain — heatmap and lot status derivation rules."""

from typing import Literal, Optional

LocationStatus = Literal["PASS", "FAIL", "PENDING", "NO_DATA", "WARNING"]


def derive_location_status(
    loc_rows: list[dict],
    risk: float,
    continuous_mode: bool,
    early_warning: bool,
) -> LocationStatus:
    """Derive a marker status from result rows, risk score, mode, and SPC flag.

    Deterministic mode: latest valuation only. Continuous mode: risk score thresholds
    with hard override for any active rejection. Early warning escalates PASS to WARNING.
    """
    latest = loc_rows[-1] if loc_rows else {}
    l_val = (latest.get("valuation") or "").upper()

    if not continuous_mode:
        status: LocationStatus = "FAIL" if l_val in ("R", "REJ", "REJECT") else "PASS"
    else:
        status = "PASS"
        if risk > 1.0:
            status = "WARNING"
        if risk > 5.0:
            status = "FAIL"
        if l_val in ("R", "REJ", "REJECT"):
            status = "FAIL"

    if early_warning and status == "PASS":
        status = "WARNING"

    return status


def lot_status(valuation: Optional[str], end_date) -> str:
    """Derive lot-level status from its aggregate valuation and end date."""
    if end_date is None:
        return "PENDING"
    v = (valuation or "").upper()
    if v == "R":
        return "FAIL"
    if v == "A":
        return "PASS"
    return "NO_DATA"
