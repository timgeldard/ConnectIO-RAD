"""Value objects for the module_template bounded context."""
from dataclasses import dataclass

from shared_domain import PlantId, ValueObject


@dataclass(frozen=True)
class TemplateMetricName(ValueObject):
    """Validated metric name used by Template Module."""

    value: str

    def __post_init__(self) -> None:
        """Validate the metric name."""
        if not self.value.strip():
            raise ValueError("Metric name cannot be blank")


@dataclass(frozen=True)
class TemplateMetricValue(ValueObject):
    """Validated numeric metric value and unit."""

    value: float
    unit: str

    def __post_init__(self) -> None:
        """Validate the metric value."""
        if not self.unit.strip():
            raise ValueError("Metric unit cannot be blank")


@dataclass(frozen=True)
class TemplateScope(ValueObject):
    """Plant scope for Template Module read models."""

    plant_id: PlantId | None = None

    @classmethod
    def from_optional(cls, plant_id: str | None) -> "TemplateScope":
        """Create a scope from an optional plant filter."""
        return cls(plant_id=PlantId(plant_id) if plant_id else None)
