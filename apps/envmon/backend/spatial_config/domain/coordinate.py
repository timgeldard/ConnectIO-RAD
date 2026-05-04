"""Domain — LocationCoordinate value object with invariant validation."""

from dataclasses import dataclass

from shared_domain import ValueObject


@dataclass(frozen=True)
class LocationCoordinate(ValueObject):
    """Immutable value object for a spatial coordinate mapping.

    x_pct and y_pct are percentages (0–100) relative to the floor plan SVG dimensions.
    Construction fails fast if any invariant is violated, so routers get a 422 before
    any SQL is executed.
    """

    func_loc_id: str
    floor_id: str
    x_pct: float
    y_pct: float

    def __post_init__(self) -> None:
        if not self.func_loc_id:
            raise ValueError("func_loc_id must not be empty")
        if not self.floor_id:
            raise ValueError("floor_id must not be empty")
        if not (0.0 <= self.x_pct <= 100.0):
            raise ValueError(f"x_pct must be 0–100, got {self.x_pct}")
        if not (0.0 <= self.y_pct <= 100.0):
            raise ValueError(f"y_pct must be 0–100, got {self.y_pct}")
