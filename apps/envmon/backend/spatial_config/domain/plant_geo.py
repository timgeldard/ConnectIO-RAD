"""Domain models for spatial configuration.

This module defines the PlantGeo value object, which encapsulates geographic
coordinates for a plant and ensures they conform to WGS-84 standards.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class PlantGeo:
    """Immutable value object for a plant's geographic pin coordinates.

    This value object ensures that geographic coordinates (latitude and longitude)
    are within valid ranges at the moment of instantiation, preventing invalid
    spatial data from propagating through the domain.

    Invariants:
        - plant_id must be a non-empty string.
        - lat must be between -90.0 and 90.0 (inclusive).
        - lon must be between -180.0 and 180.0 (inclusive).

    Args:
        plant_id: The unique identifier for the plant.
        lat: The WGS-84 latitude coordinate.
        lon: The WGS-84 longitude coordinate.
    """

    plant_id: str
    lat: float
    lon: float

    def __post_init__(self) -> None:
        """Validates the PlantGeo invariants after initialization.

        Raises:
            ValueError: If plant_id is empty or if coordinates are out of bounds.
        """
        if not self.plant_id:
            raise ValueError("plant_id must not be empty")
        if not (-90.0 <= self.lat <= 90.0):
            raise ValueError(f"lat must be -90 to 90, got {self.lat}")
        if not (-180.0 <= self.lon <= 180.0):
            raise ValueError(f"lon must be -180 to 180, got {self.lon}")
