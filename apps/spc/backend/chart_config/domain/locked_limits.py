"""LockedLimits value object — validates chart-config invariants before any SQL executes."""

from dataclasses import dataclass
from typing import Optional
from shared_domain import ValueObject, BusinessRuleValidationException

_CHART_TYPES = frozenset({
    "imr", "xbar_r", "xbar_s", "ewma", "cusum",
    "p_chart", "np_chart", "c_chart", "u_chart",
})


@dataclass(frozen=True)
class LockedLimits(ValueObject):
    """Immutable representation of a validated locked-limits record.

    Invariants checked at construction:
    - material_id and mic_id must be non-empty strings.
    - chart_type must be one of the recognised SPC chart types.
    - For p_chart (where LCL is clamped to 0): ucl >= lcl.
    - For all other chart types: ucl > lcl (strict, matching existing schema rule).
    """

    material_id: str
    mic_id: str
    chart_type: str
    cl: float
    ucl: float
    lcl: float
    plant_id: Optional[str] = None
    operation_id: Optional[str] = None
    ucl_r: Optional[float] = None
    lcl_r: Optional[float] = None
    sigma_within: Optional[float] = None
    baseline_from: Optional[str] = None
    baseline_to: Optional[str] = None
    unified_mic_key: Optional[str] = None
    mic_origin: Optional[str] = None
    spec_signature: Optional[str] = None
    locking_note: Optional[str] = None

    def __post_init__(self) -> None:
        if not self.material_id:
            raise BusinessRuleValidationException("material_id must not be empty")
        if not self.mic_id:
            raise BusinessRuleValidationException("mic_id must not be empty")
        if self.chart_type not in _CHART_TYPES:
            raise BusinessRuleValidationException(f"chart_type must be one of {sorted(_CHART_TYPES)}")
        if self.chart_type == "p_chart":
            if self.ucl < self.lcl:
                raise BusinessRuleValidationException("ucl must be >= lcl for p_chart")
        else:
            if self.ucl <= self.lcl:
                raise BusinessRuleValidationException("ucl must be > lcl")
