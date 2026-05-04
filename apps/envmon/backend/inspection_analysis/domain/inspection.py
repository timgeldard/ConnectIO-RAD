"""Domain model for environmental monitoring inspection lots."""

from __future__ import annotations

from typing import Optional

from shared_domain import BusinessRuleValidationException, Entity

from backend.inspection_analysis.domain.status import LotStatus, lot_status


def _required_text(value: str | None, field_name: str) -> str:
    normalized = (value or "").strip()
    if not normalized:
        raise BusinessRuleValidationException(f"{field_name} must not be empty")
    return normalized


def _date_text(value) -> Optional[str]:
    if value is None:
        return None
    normalized = str(value)[:10]
    return normalized or None


class InspectionLot(Entity[str]):
    """Inspection lot entity with identity and status invariants."""

    def __init__(
        self,
        *,
        lot_id: str,
        func_loc_id: str,
        inspection_start_date=None,
        inspection_end_date=None,
        valuation: Optional[str] = None,
    ) -> None:
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
        return self.identity

    @property
    def func_loc_id(self) -> str:
        return self._func_loc_id

    @property
    def inspection_start_date(self) -> Optional[str]:
        return self._inspection_start_date

    @property
    def inspection_end_date(self) -> Optional[str]:
        return self._inspection_end_date

    @property
    def valuation(self) -> Optional[str]:
        return self._valuation

    @property
    def status(self) -> LotStatus:
        return lot_status(self._valuation, self._inspection_end_date)
