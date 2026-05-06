"""Tests for status derivation logic."""

import pytest
from envmon_backend.inspection_analysis.domain.status import derive_location_status, lot_status


def test_derive_location_status_returns_no_data_for_empty_rows():
    """Verify that empty rows return NO_DATA (statistical safety)."""
    assert derive_location_status([], risk=0.0, continuous_mode=False, early_warning=False) == "NO_DATA"
    assert derive_location_status([], risk=10.0, continuous_mode=True, early_warning=True) == "NO_DATA"


def test_derive_location_status_deterministic_mode():
    """Verify simple pass/fail based on latest valuation."""
    rows = [{"valuation": "A"}]
    assert derive_location_status(rows, risk=0.0, continuous_mode=False, early_warning=False) == "PASS"

    rows = [{"valuation": "R"}]
    assert derive_location_status(rows, risk=0.0, continuous_mode=False, early_warning=False) == "FAIL"


def test_derive_location_status_continuous_mode_thresholds():
    """Verify risk-based thresholds in continuous mode."""
    rows = [{"valuation": "A"}]
    # PASS
    assert derive_location_status(rows, risk=0.5, continuous_mode=True, early_warning=False) == "PASS"
    # WARNING
    assert derive_location_status(rows, risk=1.5, continuous_mode=True, early_warning=False) == "WARNING"
    # FAIL
    assert derive_location_status(rows, risk=5.5, continuous_mode=True, early_warning=False) == "FAIL"


def test_derive_location_status_continuous_mode_hard_override():
    """Verify that a hard rejection overrides risk score."""
    rows = [{"valuation": "R"}]
    # Even with low risk, R valuation means FAIL
    assert derive_location_status(rows, risk=0.1, continuous_mode=True, early_warning=False) == "FAIL"


def test_derive_location_status_early_warning_escalation():
    """Verify that early warning escalates PASS to WARNING."""
    rows = [{"valuation": "A"}]
    # Deterministic
    assert derive_location_status(rows, risk=0.0, continuous_mode=False, early_warning=True) == "WARNING"
    # Continuous (low risk)
    assert derive_location_status(rows, risk=0.1, continuous_mode=True, early_warning=True) == "WARNING"
    
    # Does NOT downscale FAIL or WARNING
    rows = [{"valuation": "R"}]
    assert derive_location_status(rows, risk=0.1, continuous_mode=False, early_warning=True) == "FAIL"


def test_lot_status():
    """Verify lot status derivation."""
    # Pending
    assert lot_status("A", None) == "PENDING"
    # Pass
    assert lot_status("A", "2026-05-05") == "PASS"
    # Fail
    assert lot_status("R", "2026-05-05") == "FAIL"
    # No Data
    assert lot_status("UNKNOWN", "2026-05-05") == "NO_DATA"
