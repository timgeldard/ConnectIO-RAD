"""Domain models for plant scoping in warehouse management.

This module defines the PlantScope value object, which is used to restrict
operational queries and inventory management tasks to a specific plant
or to allow a global scope.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from shared_domain import ValueObject


@dataclass(frozen=True)
class PlantScope(ValueObject):
    """Value object representing the operational scope of a query or command.

    The PlantScope determines whether data access should be restricted to a
    specific plant or if it should be unrestricted (global).

    Invariants:
        - plant_id is either a non-empty stripped string or None.

    Args:
        plant_id: The unique identifier for the plant, or None for global scope.
    """

    plant_id: Optional[str] = None

    @classmethod
    def from_optional(cls, plant_id: str | None) -> "PlantScope":
        """Creates a PlantScope from an optional plant identifier.

        Normalizes the input by stripping whitespace and converting empty
        strings to None.

        Args:
            plant_id: The raw plant identifier string, which may be None
                or empty.

        Returns:
            A new instance of PlantScope with the normalized plant_id.

        Raises:
            None explicitly.
        """
        normalized = plant_id.strip() if plant_id else None
        return cls(normalized or None)

    @property
    def is_single_plant(self) -> bool:
        """Indicates if the scope is restricted to a single specific plant.

        Returns:
            True if plant_id is set, False if the scope is global.
        """
        return self.plant_id is not None
