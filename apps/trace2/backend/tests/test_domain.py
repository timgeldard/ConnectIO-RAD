"""Unit tests for trace2 domain layer pure functions.

These tests cover functions that had no direct test coverage, contributing
to the coverage gap between the 64% actual and the 75% mandate.
"""
from __future__ import annotations

import pytest

from trace2_backend.lineage_analysis.domain.lineage import LineageDepth
from trace2_backend.lineage_analysis.domain.risk import normalize_risk, supplier_risk_score
from trace2_backend.quality_record.domain.mass_balance import (
    calculate_mass_balance_variance,
    movement_delta,
)
from trace2_backend.quality_record.domain.status import (
    normalize_quality_status,
    batch_status_from_quality_stock,
)
from trace2_backend.utils.exceptions import TraceNotFound


# ---------------------------------------------------------------------------
# quality_record.domain.status
# ---------------------------------------------------------------------------

class TestNormalizeQualityStatus:
    def test_accepted_aliases(self):
        for v in ("A", "a", "ACCEPTED", "Released", "UNRESTRICTED"):
            assert normalize_quality_status(v) == "ACCEPTED"

    def test_rejected_aliases(self):
        for v in ("R", "REJECTED", "BLOCKED", "blocked"):
            assert normalize_quality_status(v) == "REJECTED"

    def test_pending_aliases(self):
        for v in ("P", "PENDING", "QI HOLD", "QUALITY_INSPECTION", "RESTRICTED"):
            assert normalize_quality_status(v) == "PENDING"

    def test_unknown_for_empty(self):
        assert normalize_quality_status(None) == "UNKNOWN"
        assert normalize_quality_status("") == "UNKNOWN"

    def test_unknown_for_unrecognised(self):
        assert normalize_quality_status("WEIRD_STATUS") == "UNKNOWN"


class TestBatchStatusFromQualityStock:
    def test_blocked_when_blocked_qty_positive(self):
        assert batch_status_from_quality_stock(blocked_qty=1.0, qi_qty=0, restricted_qty=0) == "Blocked"

    def test_blocked_when_rejected_results(self):
        assert batch_status_from_quality_stock(0, 0, 0, rejected_results=1) == "Blocked"

    def test_qi_hold_when_qi_qty_positive(self):
        assert batch_status_from_quality_stock(0, qi_qty=5.0, restricted_qty=0) == "QI Hold"

    def test_qi_hold_when_failed_mics(self):
        assert batch_status_from_quality_stock(0, 0, 0, failed_mics=2) == "QI Hold"

    def test_qi_hold_when_restricted_qty(self):
        assert batch_status_from_quality_stock(0, 0, restricted_qty=1.0) == "QI Hold"

    def test_released_when_all_zero(self):
        assert batch_status_from_quality_stock(0, 0, 0) == "Released"

    def test_blocked_takes_priority_over_qi(self):
        assert batch_status_from_quality_stock(blocked_qty=1.0, qi_qty=1.0, restricted_qty=0) == "Blocked"


# ---------------------------------------------------------------------------
# quality_record.domain.mass_balance
# ---------------------------------------------------------------------------

class TestCalculateMassBalanceVariance:
    def test_positive_variance(self):
        assert calculate_mass_balance_variance(100.0, 80.0, 25.0) == pytest.approx(5.0)

    def test_negative_variance(self):
        assert calculate_mass_balance_variance(100.0, 90.0, 5.0) == pytest.approx(-5.0)

    def test_zero_variance_exact_balance(self):
        assert calculate_mass_balance_variance(100.0, 60.0, 40.0) == pytest.approx(0.0)


class TestMovementDelta:
    def test_production_is_positive(self):
        assert movement_delta("Production", -50.0) == pytest.approx(50.0)

    def test_shipment_is_negative(self):
        assert movement_delta("Shipment", 30.0) == pytest.approx(-30.0)

    def test_other_category_passthrough(self):
        assert movement_delta("Adjustment", 10.0) == pytest.approx(10.0)
        assert movement_delta("Adjustment", -10.0) == pytest.approx(-10.0)


# ---------------------------------------------------------------------------
# lineage_analysis.domain.risk
# ---------------------------------------------------------------------------

class TestNormalizeRisk:
    def test_critical_aliases(self):
        assert normalize_risk("CRITICAL") == "CRITICAL"
        assert normalize_risk("VERY HIGH") == "CRITICAL"
        assert normalize_risk("very high") == "CRITICAL"

    def test_high(self):
        assert normalize_risk("HIGH") == "HIGH"
        assert normalize_risk("high") == "HIGH"

    def test_medium(self):
        assert normalize_risk("MEDIUM") == "MEDIUM"

    def test_low_for_unknown(self):
        assert normalize_risk(None) == "LOW"
        assert normalize_risk("") == "LOW"
        assert normalize_risk("SOMETHING_WEIRD") == "LOW"


class TestSupplierRiskScore:
    def test_low_when_no_batches(self):
        assert supplier_risk_score(0, 0) == "LOW"

    def test_critical_when_high_failure_rate(self):
        assert supplier_risk_score(6, 10) == "CRITICAL"  # 60% failure

    def test_critical_when_many_rejections(self):
        assert supplier_risk_score(11, 100) == "CRITICAL"  # >10 rejected

    def test_high_when_above_20pct(self):
        assert supplier_risk_score(3, 10) == "HIGH"  # 30%

    def test_medium_when_above_5pct(self):
        assert supplier_risk_score(1, 10) == "MEDIUM"  # 10%

    def test_low_when_below_5pct(self):
        assert supplier_risk_score(0, 100) == "LOW"


# ---------------------------------------------------------------------------
# lineage_analysis.domain.lineage
# ---------------------------------------------------------------------------

class TestLineageDepth:
    def test_clamps_below_min(self):
        assert int(LineageDepth(0)) == 1
        assert int(LineageDepth(-5)) == 1

    def test_clamps_above_max(self):
        assert int(LineageDepth(11)) == 10
        assert int(LineageDepth(999)) == 10

    def test_accepts_valid_value(self):
        assert int(LineageDepth(4)) == 4
        assert int(LineageDepth(1)) == 1
        assert int(LineageDepth(10)) == 10


# ---------------------------------------------------------------------------
# utils.exceptions
# ---------------------------------------------------------------------------

class TestTraceNotFound:
    def test_message_preserved(self):
        exc = TraceNotFound("batch B001 not found")
        assert exc.message == "batch B001 not found"
        assert str(exc) == "batch B001 not found"

    def test_is_exception(self):
        with pytest.raises(TraceNotFound, match="not found"):
            raise TraceNotFound("not found")
