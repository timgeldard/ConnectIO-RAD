"""Domain value object for Warehouse360 plant scoping."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from shared_domain import ValueObject


@dataclass(frozen=True)
class PlantScope(ValueObject):
    """Optional plant scope shared by Warehouse360 operational queries."""

    plant_id: Optional[str] = None

    @classmethod
    def from_optional(cls, plant_id: str | None) -> "PlantScope":
        normalized = plant_id.strip() if plant_id else None
        return cls(normalized or None)

    @property
    def is_single_plant(self) -> bool:
        return self.plant_id is not None
