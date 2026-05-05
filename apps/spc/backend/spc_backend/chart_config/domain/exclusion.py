"""Exclusion value object — validates exclusion snapshot invariants before any SQL executes."""

from dataclasses import dataclass
from typing import Optional
from shared_domain import ValueObject, BusinessRuleValidationException

_CHART_TYPES = frozenset({"imr", "xbar_r", "p_chart"})
_STRATIFY_KEYS = frozenset({"plant_id", "inspection_lot_id", "operation_id"})


@dataclass(frozen=True)
class Exclusion(ValueObject):
    """Immutable representation of a validated exclusion snapshot.

    Invariants checked at construction:
    - material_id and mic_id must be non-empty strings.
    - chart_type must be one of the recognised exclusion chart types.
    - stratify_by, when provided, must be one of the allowed stratification keys.
    - justification must be at least 3 characters.
    """

    material_id: str
    mic_id: str
    chart_type: str
    justification: str
    stratify_by: Optional[str] = None

    def __post_init__(self) -> None:
        if not self.material_id:
            raise BusinessRuleValidationException("material_id must not be empty")
        if not self.mic_id:
            raise BusinessRuleValidationException("mic_id must not be empty")
        if self.chart_type not in _CHART_TYPES:
            raise BusinessRuleValidationException(f"chart_type must be one of {sorted(_CHART_TYPES)}")
        if self.stratify_by is not None and self.stratify_by not in _STRATIFY_KEYS:
            raise BusinessRuleValidationException(f"stratify_by must be one of {sorted(_STRATIFY_KEYS)}")
        if len(self.justification.strip()) < 3:
            raise BusinessRuleValidationException("justification must be at least 3 characters")
