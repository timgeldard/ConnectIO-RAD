"""Domain — KPI health classification rules."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from shared_domain import ValueObject

KpiHealth = Literal["HEALTHY", "WARNING", "CRITICAL"]


@dataclass(frozen=True)
class KpiThreshold(ValueObject):
    """Immutable threshold pair for a single KPI metric.

    KPI value at or above ``warning`` triggers WARNING; at or above ``critical``
    triggers CRITICAL. Both thresholds are expressed as fractions (0.0-1.0)
    for rate-style KPIs (e.g., fill rate, on-time rate).

    Attrs:
        warning: Lower threshold; KPI below this value becomes WARNING.
        critical: Critical threshold; KPI below this value becomes CRITICAL.
    """

    warning: float
    critical: float

    def __post_init__(self) -> None:
        """
        Validate that critical threshold is not greater than warning threshold.

        Raises:
            ValueError: If critical threshold is greater than warning threshold.
        """
        if self.critical > self.warning:
            raise ValueError(
                f"critical threshold ({self.critical}) must be <= warning threshold ({self.warning})"
            )


def classify_kpi_health(value: float, threshold: KpiThreshold) -> KpiHealth:
    """Classify a KPI numeric value against a threshold pair.

    Values below ``threshold.critical`` → CRITICAL.
    Values below ``threshold.warning`` → WARNING.
    Otherwise → HEALTHY.

    Args:
        value: Current KPI value (rate-style, 0.0-1.0, or absolute count).
        threshold: Threshold pair for this KPI metric.

    Returns:
        KPI health classification.
    """
    if value < threshold.critical:
        return "CRITICAL"
    if value < threshold.warning:
        return "WARNING"
    return "HEALTHY"
