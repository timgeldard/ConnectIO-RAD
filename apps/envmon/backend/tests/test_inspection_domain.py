"""Domain tests for environmental monitoring inspection models."""

import pytest

from shared_ddd import BusinessRuleValidationException, Entity
from shared_manufacturing import test_data

from envmon_backend.inspection_analysis.domain.inspection import InspectionLot


def test_inspection_lot_is_entity_and_derives_status():
    lot_id = test_data.inspection_lot()
    lot = InspectionLot(
        lot_id=lot_id,
        func_loc_id="LOC-1",
        inspection_start_date="2026-04-01 08:00:00",
        inspection_end_date="2026-04-02 08:00:00",
        valuation="R",
    )

    assert isinstance(lot, Entity)
    assert lot.identity == lot_id
    assert lot.inspection_start_date == "2026-04-01"
    assert lot.inspection_end_date == "2026-04-02"
    assert lot.status == "FAIL"


def test_inspection_lot_without_end_date_is_pending():
    lot_id = test_data.inspection_lot()
    lot = InspectionLot(lot_id=lot_id, func_loc_id="LOC-1", valuation="A")

    assert lot.status == "PENDING"


def test_inspection_lot_rejects_missing_identity_fields():
    lot_id = test_data.inspection_lot()
    with pytest.raises(BusinessRuleValidationException, match="lot_id"):
        InspectionLot(lot_id="", func_loc_id="LOC-1")

    with pytest.raises(BusinessRuleValidationException, match="func_loc_id"):
        InspectionLot(lot_id=lot_id, func_loc_id=" ")


def test_inspection_lot_rejects_end_date_before_start_date():
    lot_id = test_data.inspection_lot()
    with pytest.raises(BusinessRuleValidationException, match="inspection_start_date"):
        InspectionLot(
            lot_id=lot_id,
            func_loc_id="LOC-1",
            inspection_start_date="2026-04-03",
            inspection_end_date="2026-04-02",
        )
