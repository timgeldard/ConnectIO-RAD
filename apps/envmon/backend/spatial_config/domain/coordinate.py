"""Domain models for location coordinates.

This module defines the LocationCoordinate value object, which represents
a position on a floor plan relative to its dimensions.
"""

from dataclasses import dataclass

from shared_domain import ValueObject


@dataclass(frozen=True)
class LocationCoordinate(ValueObject):
    """Immutable value object for a spatial coordinate mapping.

    This value object represents a functional location's position on a specific
    floor plan using percentage-based coordinates. It ensures that the position
    is within the valid 0-100% range of the floor plan dimensions.

    Invariants:
        - func_loc_id must be a non-empty string.
        - floor_id must be a non-empty string.
        - x_pct must be between 0.0 and 100.0 (inclusive).
        - y_pct must be between 0.0 and 100.0 (inclusive).

    Args:
        func_loc_id: The unique identifier for the functional location.
        floor_id: The unique identifier for the floor plan.
        x_pct: The horizontal position as a percentage (0-100).
        y_pct: The vertical position as a percentage (0-100).
    """

    func_loc_id: str
    floor_id: str
    x_pct: float
    y_pct: float

    def __post_init__(self) -> None:
        """Validates the LocationCoordinate invariants after initialization.

        Raises:
            ValueError: If identifiers are empty or coordinates are outside 0-100%.
        """
        if not self.func_loc_id:
            raise ValueError("func_loc_id must not be empty")
        if not self.floor_id:
            raise ValueError("floor_id must not be empty")
        if not (0.0 <= self.x_pct <= 100.0):
            raise ValueError(f"x_pct must be 0–100, got {self.x_pct}")
        if not (0.0 <= self.y_pct <= 100.0):
            raise ValueError(f"y_pct must be 0–100, got {self.y_pct}")
