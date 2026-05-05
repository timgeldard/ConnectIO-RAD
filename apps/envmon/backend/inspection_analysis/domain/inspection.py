"""Domain model for environmental monitoring inspection lots.

This module defines the InspectionLot entity, which encapsulates the data
and invariants for an SAP inspection lot within the environmental
monitoring context.
"""

from __future__ import annotations

from typing import Any, Optional

from shared_domain import BusinessRuleValidationException, Entity

from backend.inspection_analysis.domain.status import LotStatus, lot_status


def _required_text(value: str | None, field_name: str) -> str:
    """Validates and normalizes required text fields.

    Args:
        value: The raw string value to validate.
        field_name: The name of the field (for error reporting).

    Returns:
        The stripped, non-empty string.

    Raises:
        BusinessRuleValidationException: If the value is empty or only whitespace.
    """
    normalized = (value or "").strip()
    if not normalized:
        raise BusinessRuleValidationException(f"{field_name} must not be empty")
    return normalized


def _date_text(value: Any) -> Optional[str]:
    """Normalizes a date-like value into a YYYY-MM-DD string.

    Args:
        value: The raw date value (string, date object, etc.).

    Returns:
        The first 10 characters of the string representation, or None if empty.

    Raises:
        None explicitly.
    """
    if value is None:
        return None
    normalized = str(value)[:10]
    return normalized or None


class InspectionLot(Entity[str]):
    """Inspection lot entity with identity and status invariants.

    An InspectionLot represents a single quality inspection process for a
    functional location. It tracks the timing, valuation, and derived status
    of the inspection.

    Invariants:
        - lot_id must be a non-empty string.
        - func_loc_id must be a non-empty string.
        - inspection_start_date must be on or before inspection_end_date
          if both are provided.

    Args:
        lot_id: The unique identifier for the inspection lot.
        func_loc_id: The identifier for the functional location.
        inspection_start_date: Optional start date of the inspection.
        inspection_end_date: Optional end date of the inspection.
        valuation: Optional aggregate valuation result (e.g., 'A', 'R').
    """

    def __init__(
        self,
        *,
        lot_id: str,
        func_loc_id: str,
        inspection_start_date: Any = None,
        inspection_end_date: Any = None,
        valuation: Optional[str] = None,
    ) -> None:
        """Initializes a new InspectionLot instance.

        Raises:
            BusinessRuleValidationException: If any invariants are violated.
        """
        lot_identity = _required_text(lot_id, "lot_id")
        super().__init__(lot_identity)
        self._func_loc_id = _required_text(func_loc_id, "func_loc_id")
        self._inspection_start_date = _date_text(inspection_start_date)
        self._inspection_end_date = _date_text(inspection_end_date)
        self._valuation = valuation

        if (
            self._inspection_start_date is not None
            and self._inspection_end_date is not None
            and self._inspection_start_date > self._inspection_end_date
        ):
            raise BusinessRuleValidationException("inspection_start_date must be on or before inspection_end_date")

    @property
    def lot_id(self) -> str:
        """Returns the unique identifier for the inspection lot.

        Returns:
            The lot_id string.
        """
        return self.identity

    @property
    def func_loc_id(self) -> str:
        """Returns the identifier for the functional location.

        Returns:
            The func_loc_id string.
        """
        return self._func_loc_id

    @property
    def inspection_start_date(self) -> Optional[str]:
        """Returns the inspection start date in YYYY-MM-DD format.

        Returns:
            The start date string or None if not set.
        """
        return self._inspection_start_date

    @property
    def inspection_end_date(self) -> Optional[str]:
        """Returns the inspection end date in YYYY-MM-DD format.

        Returns:
            The end date string or None if not set.
        """
        return self._inspection_end_date

    @property
    def valuation(self) -> Optional[str]:
        """Returns the aggregate valuation of the inspection lot.

        Returns:
            The valuation string (e.g., 'A') or None if not yet valuated.
        """
        return self._valuation

    @property
    def status(self) -> LotStatus:
        """Derives the current status of the inspection lot.

        Returns:
            The derived LotStatus ('PASS', 'FAIL', 'PENDING', or 'NO_DATA').
        """
        return lot_status(self._valuation, self._inspection_end_date)
