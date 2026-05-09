"""
Common Value Objects for Manufacturing and Supply Chain domains.
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Optional

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
