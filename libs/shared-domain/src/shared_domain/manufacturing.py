"""
Common Value Objects for Manufacturing and Supply Chain domains.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from .models import ValueObject
from .exceptions import BusinessRuleValidationException


class PlantId(str):
    """
    Value object for Plant ID (e.g. 'P001', 'US10').
    Trims input and enforces common format constraints.
    """
    def __new__(cls, value: str):
        if not value or not value.strip():
            raise BusinessRuleValidationException("PlantId cannot be blank")
        stripped = value.strip().upper()
        if len(stripped) > 10:
            raise BusinessRuleValidationException("PlantId exceeds maximum length of 10 characters")
        return super().__new__(cls, stripped)


class MaterialId(str):
    """Value object for material identifiers."""

    def __new__(cls, value: str):
        if not value or not value.strip():
            raise BusinessRuleValidationException("MaterialId cannot be blank")
        return super().__new__(cls, value.strip().upper())


class BatchId(str):
    """Value object for batch or lot identifiers."""

    def __new__(cls, value: str):
        if not value or not value.strip():
            raise BusinessRuleValidationException("BatchId cannot be blank")
        return super().__new__(cls, value.strip().upper())


@dataclass(frozen=True)
class Quantity(ValueObject):
    """
    Value object representing a numeric amount with a unit of measure.
    """
    value: Decimal
    uom: str

    def __post_init__(self):
        if self.value < 0:
            raise BusinessRuleValidationException("Quantity value cannot be negative")
        if not self.uom:
            raise BusinessRuleValidationException("Unit of measure is required")

    def __str__(self) -> str:
        return f"{self.value:g} {self.uom}"

    @classmethod
    def from_float(cls, value: float, uom: str) -> Quantity:
        return cls(value=Decimal(str(value)), uom=uom)

    def add(self, other: Quantity) -> Quantity:
        if self.uom != other.uom:
            raise BusinessRuleValidationException(
                f"Cannot add quantities with different units: {self.uom} and {other.uom}"
            )
        return Quantity(self.value + other.value, self.uom)


@dataclass(frozen=True)
class Measurement(ValueObject):
    """Observed measurement for a material, batch, or process characteristic."""

    value: Decimal
    unit: str
    measured_at: datetime

    def __post_init__(self) -> None:
        """Validate measurement invariants."""
        if not self.unit.strip():
            raise BusinessRuleValidationException("Measurement unit is required")

    @classmethod
    def now(cls, value: float | Decimal, unit: str) -> Measurement:
        """Create a measurement timestamped with current UTC time."""
        return cls(value=Decimal(str(value)), unit=unit, measured_at=datetime.now(timezone.utc))


@dataclass(frozen=True)
class Specification(ValueObject):
    """Inclusive lower/upper specification limits for a measurement."""

    lower: Decimal | None = None
    upper: Decimal | None = None
    unit: str = ""

    def __post_init__(self) -> None:
        """Validate specification limit ordering."""
        if self.lower is None and self.upper is None:
            raise BusinessRuleValidationException("Specification requires at least one limit")
        if self.lower is not None and self.upper is not None and self.lower > self.upper:
            raise BusinessRuleValidationException("Specification lower limit cannot exceed upper limit")
        if not self.unit.strip():
            raise BusinessRuleValidationException("Specification unit is required")

    def contains(self, measurement: Measurement) -> bool:
        """Return True when a measurement is within specification."""
        if measurement.unit != self.unit:
            raise BusinessRuleValidationException(
                f"Measurement unit {measurement.unit} does not match specification unit {self.unit}"
            )
        if self.lower is not None and measurement.value < self.lower:
            return False
        if self.upper is not None and measurement.value > self.upper:
            return False
        return True


@dataclass(frozen=True)
class Material(ValueObject):
    """Material identity and optional display name."""

    material_id: MaterialId
    material_name: str | None = None


@dataclass(frozen=True)
class Batch(ValueObject):
    """Batch identity anchored to material and plant."""

    batch_id: BatchId
    material_id: MaterialId
    plant_id: PlantId


@dataclass(frozen=True)
class PlantScope(ValueObject):
    """
    Represents a scope of visibility within the manufacturing context.
    """
    authorized_plants: frozenset[PlantId]

    def contains(self, plant_id: str | PlantId) -> bool:
        return PlantId(str(plant_id)) in self.authorized_plants

    @classmethod
    def global_scope(cls) -> PlantScope:
        """Represents visibility into all plants (no filtering)."""
        return cls(authorized_plants=frozenset())

    @property
    def is_global(self) -> bool:
        return not self.authorized_plants


class WorkCenterId(str):
    """
    Value object for a Work Center or Production Line ID.
    """
    def __new__(cls, value: str):
        if not value or not value.strip():
            raise BusinessRuleValidationException("WorkCenterId cannot be blank")
        return super().__new__(cls, value.strip().upper())


@dataclass(frozen=True)
class GoodsMovement(ValueObject):
    """
    Represents a movement of material between locations.
    """
    material_id: str
    quantity: Quantity
    from_location: Optional[str] = None
    to_location: Optional[str] = None
    movement_type: Optional[str] = None
    timestamp: Optional[str] = None

    def __post_init__(self):
        if not self.material_id:
            raise BusinessRuleValidationException("Material ID is required for GoodsMovement")
