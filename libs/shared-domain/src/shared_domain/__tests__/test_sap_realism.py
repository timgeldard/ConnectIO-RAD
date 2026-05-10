"""
Tests to verify SAP data realism and edge case handling.
"""
from shared_domain import test_data


def test_material_id_is_always_8_digits():
    for _ in range(100):
        mat_id = test_data.material_id()
        assert len(mat_id) == 8
        assert mat_id.isdigit()


def test_batch_id_is_always_10_digits():
    for _ in range(100):
        b_id = test_data.batch_id()
        assert len(b_id) == 10
        assert b_id.isdigit()


def test_process_order_is_always_12_digits():
    for _ in range(100):
        po_id = test_data.process_order()
        assert len(po_id) == 12
        assert po_id.isdigit()


def test_inspection_lot_starts_with_01_and_is_12_digits():
    for _ in range(100):
        lot_id = test_data.inspection_lot()
        assert len(lot_id) == 12
        assert lot_id.startswith("01")


def test_generate_batch_row_has_realistic_data():
    row = test_data.generate_batch_row()
    assert len(row["material_id"]) == 8
    assert len(row["batch_id"]) == 10
    assert row["plant_id"] in test_data.PLANTS
    assert row["uom"] in test_data.UOMS
    # Verify decimal string format for quantities (standard for SQL API mocks)
    assert "." in row["unrestricted"]


def test_generate_order_row_has_realistic_data():
    row = test_data.generate_order_row()
    assert len(row["process_order_id"]) == 12
    assert len(row["inspection_lot_id"]) == 12
    assert row["material_category"] in test_data.CATEGORIES
    assert isinstance(row["start_ms"], int)
    assert row["start_ms"] > 1600000000000 # Realistic timestamp
