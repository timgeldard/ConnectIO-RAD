"""Domain — PlantGeo value object with geographic bounds validation."""

from dataclasses import dataclass


@dataclass(frozen=True)
class PlantGeo:
    """Immutable value object for a plant's geographic pin coordinates.

    Validates WGS-84 latitude (-90 to 90) and longitude (-180 to 180) at construction,
    so invalid values are rejected before any SQL is executed.
    """

    plant_id: str
    lat: float
    lon: float

    def __post_init__(self) -> None:
        if not self.plant_id:
            raise ValueError("plant_id must not be empty")
        if not (-90.0 <= self.lat <= 90.0):
            raise ValueError(f"lat must be -90 to 90, got {self.lat}")
        if not (-180.0 <= self.lon <= 180.0):
            raise ValueError(f"lon must be -180 to 180, got {self.lon}")
