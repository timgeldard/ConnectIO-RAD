"""Unit tests for operations_control_tower domain — KPI health classification."""

import pytest

from backend.operations_control_tower.domain.kpi_health import (
    KpiThreshold,
    classify_kpi_health,
)


class TestKpiThreshold:
    """Tests for the KpiThreshold value object."""

    def test_is_frozen_value_object(self) -> None:
        """Verify that KpiThreshold is immutable."""
        threshold = KpiThreshold(warning=0.90, critical=0.80)
        with pytest.raises((AttributeError, TypeError)):
            threshold.warning = 0.85  # type: ignore[misc]

    def test_equality_by_value(self) -> None:
        """Verify that two KpiThreshold instances with same values are equal."""
        assert KpiThreshold(0.90, 0.80) == KpiThreshold(0.90, 0.80)

    def test_inequality_when_values_differ(self) -> None:
        """Verify that two KpiThreshold instances with different values are not equal."""
        assert KpiThreshold(0.90, 0.80) != KpiThreshold(0.95, 0.85)

    def test_rejects_critical_above_warning(self) -> None:
        """Verify that an error is raised if critical threshold is above warning."""
        with pytest.raises(ValueError):
            KpiThreshold(warning=0.80, critical=0.90)

    def test_equal_thresholds_allowed(self) -> None:
        """Verify that equal warning and critical thresholds are permitted."""
        t = KpiThreshold(warning=0.85, critical=0.85)
        assert t.warning == t.critical


class TestClassifyKpiHealth:
    """Tests for the classify_kpi_health domain function."""

    def setup_method(self) -> None:
        """Initialize common test threshold."""
        self.threshold = KpiThreshold(warning=0.90, critical=0.80)

    def test_healthy_at_or_above_warning(self) -> None:
        """Verify HEALTHY classification for values at or above warning threshold."""
        assert classify_kpi_health(0.90, self.threshold) == "HEALTHY"
        assert classify_kpi_health(1.00, self.threshold) == "HEALTHY"
        assert classify_kpi_health(0.95, self.threshold) == "HEALTHY"

    def test_warning_between_thresholds(self) -> None:
        """Verify WARNING classification for values between warning and critical thresholds."""
        assert classify_kpi_health(0.85, self.threshold) == "WARNING"
        assert classify_kpi_health(0.80, self.threshold) == "WARNING"

    def test_critical_below_critical_threshold(self) -> None:
        """Verify CRITICAL classification for values below critical threshold."""
        assert classify_kpi_health(0.79, self.threshold) == "CRITICAL"
        assert classify_kpi_health(0.0, self.threshold) == "CRITICAL"

    def test_boundary_exactly_at_warning(self) -> None:
        """Verify that exactly the warning value is still HEALTHY."""
        assert classify_kpi_health(0.90, self.threshold) == "HEALTHY"

    def test_boundary_just_below_warning(self) -> None:
        """Verify that just below warning value is WARNING."""
        assert classify_kpi_health(0.8999, self.threshold) == "WARNING"

    def test_boundary_exactly_at_critical(self) -> None:
        """Verify that exactly the critical value is still WARNING."""
        assert classify_kpi_health(0.80, self.threshold) == "WARNING"

    def test_boundary_just_below_critical(self) -> None:
        """Verify that just below critical value is CRITICAL."""
        assert classify_kpi_health(0.7999, self.threshold) == "CRITICAL"

    def test_absolute_count_kpi(self) -> None:
        """Verify that KpiThreshold also works for absolute values, not just ratios."""
        threshold = KpiThreshold(warning=100.0, critical=50.0)
        assert classify_kpi_health(120.0, threshold) == "HEALTHY"
        assert classify_kpi_health(75.0, threshold) == "WARNING"
        assert classify_kpi_health(30.0, threshold) == "CRITICAL"
