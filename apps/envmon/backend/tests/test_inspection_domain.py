"""Domain tests for environmental monitoring inspection models."""

import pytest

from shared_domain import BusinessRuleValidationException, Entity

from backend.inspection_analysis.domain.inspection import InspectionLot


def test_inspection_lot_is_entity_and_derives_status():
    lot = InspectionLot(
        lot_id="LOT-1",
        func_loc_id="LOC-1",
        inspection_start_date="2026-04-01 08:00:00",
        inspection_end_date="2026-04-02 08:00:00",
        valuation="R",
    )

    assert isinstance(lot, Entity)
    assert lot.identity == "LOT-1"
    assert lot.inspection_start_date == "2026-04-01"
    assert lot.inspection_end_date == "2026-04-02"
    assert lot.status == "FAIL"


def test_inspection_lot_without_end_date_is_pending():
    lot = InspectionLot(lot_id="LOT-1", func_loc_id="LOC-1", valuation="A")

    assert lot.status == "PENDING"


def test_inspection_lot_rejects_missing_identity_fields():
    with pytest.raises(BusinessRuleValidationException, match="lot_id"):
        InspectionLot(lot_id="", func_loc_id="LOC-1")

    with pytest.raises(BusinessRuleValidationException, match="func_loc_id"):
        InspectionLot(lot_id="LOT-1", func_loc_id=" ")


def test_inspection_lot_rejects_end_date_before_start_date():
    with pytest.raises(BusinessRuleValidationException, match="inspection_start_date"):
        InspectionLot(
            lot_id="LOT-1",
            func_loc_id="LOC-1",
            inspection_start_date="2026-04-03",
            inspection_end_date="2026-04-02",
        )
