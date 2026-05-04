"""Unit tests for operations_control_tower domain — KPI health classification."""

import pytest

from backend.operations_control_tower.domain.kpi_health import (
    KpiHealth,
    KpiThreshold,
    classify_kpi_health,
)


class TestKpiThreshold:
    def test_is_frozen_value_object(self) -> None:
        threshold = KpiThreshold(warning=0.90, critical=0.80)
        with pytest.raises((AttributeError, TypeError)):
            threshold.warning = 0.85  # type: ignore[misc]

    def test_equality_by_value(self) -> None:
        assert KpiThreshold(0.90, 0.80) == KpiThreshold(0.90, 0.80)

    def test_inequality_when_values_differ(self) -> None:
        assert KpiThreshold(0.90, 0.80) != KpiThreshold(0.95, 0.85)

    def test_rejects_critical_above_warning(self) -> None:
        with pytest.raises(ValueError):
            KpiThreshold(warning=0.80, critical=0.90)

    def test_equal_thresholds_allowed(self) -> None:
        t = KpiThreshold(warning=0.85, critical=0.85)
        assert t.warning == t.critical


class TestClassifyKpiHealth:
    def setup_method(self) -> None:
        self.threshold = KpiThreshold(warning=0.90, critical=0.80)

    def test_healthy_at_or_above_warning(self) -> None:
        assert classify_kpi_health(0.90, self.threshold) == "HEALTHY"
        assert classify_kpi_health(1.00, self.threshold) == "HEALTHY"
        assert classify_kpi_health(0.95, self.threshold) == "HEALTHY"

    def test_warning_between_thresholds(self) -> None:
        assert classify_kpi_health(0.85, self.threshold) == "WARNING"
        assert classify_kpi_health(0.80, self.threshold) == "WARNING"

    def test_critical_below_critical_threshold(self) -> None:
        assert classify_kpi_health(0.79, self.threshold) == "CRITICAL"
        assert classify_kpi_health(0.0, self.threshold) == "CRITICAL"

    def test_boundary_exactly_at_warning(self) -> None:
        assert classify_kpi_health(0.90, self.threshold) == "HEALTHY"

    def test_boundary_just_below_warning(self) -> None:
        assert classify_kpi_health(0.8999, self.threshold) == "WARNING"

    def test_boundary_exactly_at_critical(self) -> None:
        assert classify_kpi_health(0.80, self.threshold) == "WARNING"

    def test_boundary_just_below_critical(self) -> None:
        assert classify_kpi_health(0.7999, self.threshold) == "CRITICAL"

    def test_absolute_count_kpi(self) -> None:
        """KpiThreshold also works for absolute values, not just ratios."""
        threshold = KpiThreshold(warning=100.0, critical=50.0)
        assert classify_kpi_health(120.0, threshold) == "HEALTHY"
        assert classify_kpi_health(75.0, threshold) == "WARNING"
        assert classify_kpi_health(30.0, threshold) == "CRITICAL"
