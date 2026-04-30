"""Unit tests for order_detail_dal — coerce helpers, derivation helpers, and fetch_order_detail."""
import asyncio
from unittest.mock import patch

import pytest

from backend.dal import order_detail_dal as dal


# ---------------------------------------------------------------------------
# _coerce_header
# ---------------------------------------------------------------------------

def test_coerce_header_converts_timestamps():
    """Verify that manufacture and expiry date strings are converted to integers."""
    row = {"manufacture_date_ms": "1700000000000", "expiry_date_ms": "1710000000000"}
    result = dal._coerce_header(row)
    assert result["manufacture_date_ms"] == 1700000000000
    assert result["expiry_date_ms"] == 1710000000000


def test_coerce_header_handles_null_timestamps():
    """Verify that null manufacture and expiry dates are preserved."""
    row = {"manufacture_date_ms": None, "expiry_date_ms": None}
    result = dal._coerce_header(row)
    assert result["manufacture_date_ms"] is None
    assert result["expiry_date_ms"] is None


# ---------------------------------------------------------------------------
# _coerce_phase
# ---------------------------------------------------------------------------

def test_coerce_phase_converts_floats():
    row = {"setup_s": "120", "mach_s": "3600", "clean_s": "300", "operation_quantity": "500"}
    result = dal._coerce_phase(row)
    assert result["setup_s"] == 120.0
    assert result["mach_s"] == 3600.0
    assert result["clean_s"] == 300.0
    assert result["operation_quantity"] == 500.0


def test_coerce_phase_defaults_nones_to_zero():
    row = {"setup_s": None, "mach_s": None, "clean_s": None, "operation_quantity": None}
    result = dal._coerce_phase(row)
    assert result["setup_s"] == 0.0
    assert result["operation_quantity"] == 0.0


# ---------------------------------------------------------------------------
# _coerce_movement
# ---------------------------------------------------------------------------

def test_coerce_movement_converts_qty_and_timestamp():
    row = {"quantity": "250.5", "date_time_of_entry": "1700000000000"}
    result = dal._coerce_movement(row)
    assert result["quantity"] == 250.5
    assert result["date_time_of_entry"] == 1700000000000


def test_coerce_movement_handles_nulls():
    row = {"quantity": None, "date_time_of_entry": None}
    result = dal._coerce_movement(row)
    assert result["quantity"] == 0.0
    assert result["date_time_of_entry"] is None


# ---------------------------------------------------------------------------
# _coerce_comment
# ---------------------------------------------------------------------------

def test_coerce_comment_converts_timestamp():
    row = {"created_ms": "1700000000000"}
    assert dal._coerce_comment(row)["created_ms"] == 1700000000000


def test_coerce_comment_handles_null():
    assert dal._coerce_comment({"created_ms": None})["created_ms"] is None


# ---------------------------------------------------------------------------
# _coerce_downtime
# ---------------------------------------------------------------------------

def test_coerce_downtime_converts_fields():
    row = {"start_time_ms": "1700000000000", "duration_s": "600"}
    result = dal._coerce_downtime(row)
    assert result["start_time_ms"] == 1700000000000
    assert result["duration_s"] == 600.0


def test_coerce_downtime_handles_nulls():
    row = {"start_time_ms": None, "duration_s": None}
    result = dal._coerce_downtime(row)
    assert result["start_time_ms"] is None
    assert result["duration_s"] == 0.0


# ---------------------------------------------------------------------------
# _coerce_equipment
# ---------------------------------------------------------------------------

def test_coerce_equipment_converts_timestamp():
    row = {"change_at_ms": "1700000000000"}
    assert dal._coerce_equipment(row)["change_at_ms"] == 1700000000000


def test_coerce_equipment_handles_null():
    assert dal._coerce_equipment({"change_at_ms": None})["change_at_ms"] is None


# ---------------------------------------------------------------------------
# _coerce_inspection
# ---------------------------------------------------------------------------

def test_coerce_inspection_converts_quantitative_result():
    row = {"quantitative_result": "98.5"}
    assert dal._coerce_inspection(row)["quantitative_result"] == 98.5


def test_coerce_inspection_handles_null():
    assert dal._coerce_inspection({"quantitative_result": None})["quantitative_result"] is None


# ---------------------------------------------------------------------------
# _coerce_usage_decision
# ---------------------------------------------------------------------------

def test_coerce_usage_decision_converts_fields():
    row = {"created_date_ms": "1700000000000", "quality_score": "95.0"}
    result = dal._coerce_usage_decision(row)
    assert result["created_date_ms"] == 1700000000000
    assert result["quality_score"] == 95.0


def test_coerce_usage_decision_handles_nulls():
    row = {"created_date_ms": None, "quality_score": None}
    result = dal._coerce_usage_decision(row)
    assert result["created_date_ms"] is None
    assert result["quality_score"] is None


# ---------------------------------------------------------------------------
# _to_kg
# ---------------------------------------------------------------------------

def test_to_kg_ea_returns_zero():
    assert dal._to_kg(500.0, "EA") == 0.0


def test_to_kg_g_divides_by_1000():
    assert dal._to_kg(1000.0, "G") == 1.0


def test_to_kg_kg_passthrough():
    assert dal._to_kg(500.0, "KG") == 500.0


def test_to_kg_case_insensitive():
    assert dal._to_kg(1000.0, "g") == 1.0
    assert dal._to_kg(500.0, "ea") == 0.0


def test_to_kg_none_uom_passthrough():
    assert dal._to_kg(500.0, None) == 500.0


def test_to_kg_whitespace_stripped():
    assert dal._to_kg(1000.0, "  G  ") == 1.0


# ---------------------------------------------------------------------------
# _derive_materials
# ---------------------------------------------------------------------------

def test_derive_materials_aggregates_261_movements():
    movements = [
        {"movement_type": "261", "material_id": "MAT-1", "material_name": "Sugar",
         "batch_id": "B001", "quantity": 100.0, "uom": "KG"},
        {"movement_type": "261", "material_id": "MAT-1", "material_name": "Sugar",
         "batch_id": "B001", "quantity": 50.0, "uom": "KG"},
        {"movement_type": "261", "material_id": "MAT-2", "material_name": "Salt",
         "batch_id": "B002", "quantity": 10.0, "uom": "KG"},
        {"movement_type": "101", "material_id": "MAT-3", "material_name": "Output",
         "batch_id": "B003", "quantity": 200.0, "uom": "KG"},
    ]
    result = dal._derive_materials(movements)
    assert len(result) == 2
    mat1 = next(m for m in result if m["material_id"] == "MAT-1")
    assert mat1["total_qty"] == 150.0
    assert mat1["material_name"] == "Sugar"
    mat2 = next(m for m in result if m["material_id"] == "MAT-2")
    assert mat2["total_qty"] == 10.0


def test_derive_materials_empty_when_no_261():
    movements = [
        {"movement_type": "101", "material_id": "MAT-1", "material_name": "X",
         "batch_id": None, "quantity": 100.0, "uom": "KG"},
    ]
    assert dal._derive_materials(movements) == []


def test_derive_materials_uses_first_batch_id():
    movements = [
        {"movement_type": "261", "material_id": "MAT-1", "material_name": "X",
         "batch_id": "FIRST", "quantity": 10.0, "uom": "KG"},
        {"movement_type": "261", "material_id": "MAT-1", "material_name": "X",
         "batch_id": "SECOND", "quantity": 5.0, "uom": "KG"},
    ]
    result = dal._derive_materials(movements)
    assert result[0]["batch_id"] == "FIRST"


def test_derive_materials_subtracts_262_from_261():
    movements = [
        {"movement_type": "261", "material_id": "MAT-1", "material_name": "Sugar",
         "batch_id": "B001", "quantity": 100.0, "uom": "KG"},
        {"movement_type": "262", "material_id": "MAT-1", "material_name": "Sugar",
         "batch_id": "B001", "quantity": 30.0, "uom": "KG"},
    ]
    result = dal._derive_materials(movements)
    assert len(result) == 1
    assert result[0]["total_qty"] == 70.0


def test_derive_materials_excludes_fully_reversed_material():
    movements = [
        {"movement_type": "261", "material_id": "MAT-1", "material_name": "X",
         "batch_id": "B001", "quantity": 50.0, "uom": "KG"},
        {"movement_type": "262", "material_id": "MAT-1", "material_name": "X",
         "batch_id": "B001", "quantity": 50.0, "uom": "KG"},
    ]
    result = dal._derive_materials(movements)
    assert result == []


def test_derive_materials_excludes_ea_materials():
    movements = [
        {"movement_type": "261", "material_id": "PKG-1", "material_name": "Box",
         "batch_id": "B001", "quantity": 500.0, "uom": "EA"},
        {"movement_type": "261", "material_id": "MAT-1", "material_name": "Sugar",
         "batch_id": "B002", "quantity": 100.0, "uom": "KG"},
    ]
    result = dal._derive_materials(movements)
    assert len(result) == 1
    assert result[0]["material_id"] == "MAT-1"


def test_derive_materials_rounds_to_6dp():
    movements = [
        {"movement_type": "261", "material_id": "MAT-1", "material_name": "X",
         "batch_id": "B001", "quantity": 1000.0, "uom": "G"},  # → 1.0 KG
        {"movement_type": "262", "material_id": "MAT-1", "material_name": "X",
         "batch_id": "B001", "quantity": 1.0, "uom": "G"},   # → 0.001 KG
    ]
    result = dal._derive_materials(movements)
    assert len(result) == 1
    assert result[0]["total_qty"] == round(0.999, 6)


# ---------------------------------------------------------------------------
# _movement_summary
# ---------------------------------------------------------------------------

def test_movement_summary_sums_issued_and_received():
    movements = [
        {"movement_type": "261", "quantity": 100.0},
        {"movement_type": "261", "quantity": 50.0},
        {"movement_type": "101", "quantity": 200.0},
    ]
    result = dal._movement_summary(movements)
    assert result["qty_issued_kg"] == 150.0
    assert result["qty_received_kg"] == 200.0


def test_movement_summary_returns_none_when_zero():
    movements = []
    result = dal._movement_summary(movements)
    assert result["qty_issued_kg"] is None
    assert result["qty_received_kg"] is None


def test_movement_summary_issued_none_when_no_261():
    movements = [{"movement_type": "101", "quantity": 100.0}]
    result = dal._movement_summary(movements)
    assert result["qty_issued_kg"] is None
    assert result["qty_received_kg"] == 100.0


def test_movement_summary_subtracts_262_from_issued():
    movements = [
        {"movement_type": "261", "quantity": 100.0, "uom": "KG"},
        {"movement_type": "262", "quantity": 25.0, "uom": "KG"},
        {"movement_type": "101", "quantity": 80.0, "uom": "KG"},
    ]
    result = dal._movement_summary(movements)
    assert result["qty_issued_kg"] == 75.0
    assert result["qty_received_kg"] == 80.0


def test_movement_summary_issued_none_when_fully_reversed():
    movements = [
        {"movement_type": "261", "quantity": 50.0, "uom": "KG"},
        {"movement_type": "262", "quantity": 50.0, "uom": "KG"},
    ]
    result = dal._movement_summary(movements)
    assert result["qty_issued_kg"] is None


def test_movement_summary_subtracts_102_from_received():
    movements = [
        {"movement_type": "101", "quantity": 100.0, "uom": "KG"},
        {"movement_type": "102", "quantity": 10.0, "uom": "KG"},
        {"movement_type": "261", "quantity": 50.0, "uom": "KG"},
    ]
    result = dal._movement_summary(movements)
    assert result["qty_received_kg"] == 90.0
    assert result["qty_issued_kg"] == 50.0


def test_movement_summary_received_none_when_fully_reversed():
    movements = [
        {"movement_type": "101", "quantity": 50.0, "uom": "KG"},
        {"movement_type": "102", "quantity": 50.0, "uom": "KG"},
    ]
    result = dal._movement_summary(movements)
    assert result["qty_received_kg"] is None


def test_time_summary_sums_across_phases():
    phases = [
        {"setup_s": 60.0, "mach_s": 3600.0, "clean_s": 120.0},
        {"setup_s": 30.0, "mach_s": 1800.0, "clean_s": 60.0},
    ]
    result = dal._time_summary(phases)
    assert result["setup_s"] == 90.0
    assert result["mach_s"] == 5400.0
    assert result["clean_s"] == 180.0


def test_time_summary_empty_phases():
    result = dal._time_summary([])
    assert result == {"setup_s": 0, "mach_s": 0, "clean_s": 0}


# ---------------------------------------------------------------------------
# fetch_order_detail — integration (mocked run_sql_async)
# ---------------------------------------------------------------------------

_HEADER_ROW = {
    "process_order_id": "PO-001",
    "inspection_lot_id": "LOT-001",
    "material_id": "MAT-001",
    "plant_id": "P001",
    "raw_status": "IN PROGRESS",
    "status": "running",
    "material_name": "Test Product",
    "material_category": "Dairy",
    "batch_id": "B001",
    "manufacture_date_ms": 1700000000000,
    "expiry_date_ms": 1710000000000,
    "supplier_batch_id": "SUP-B001",
}

_PHASE_ROW = {
    "phase_id": "PH-01", "phase_description": "Mix", "phase_text": None,
    "operation_quantity": 500.0, "operation_quantity_uom": "KG",
    "start_user": "user1", "end_user": "user2",
    "setup_s": 120.0, "mach_s": 3600.0, "clean_s": 300.0,
}

_MOVEMENT_ROW = {
    "material_id": "MAT-002", "material_name": "Ingredient", "batch_id": "B002",
    "movement_type": "261", "quantity": 100.0, "uom": "KG",
    "storage_id": "STOR-01", "user_name": "user1", "date_time_of_entry": 1700001000000,
}

_UD_ROW = {
    "usage_decision_code": "A", "valuation_code": "GOOD",
    "quality_score": 95.0, "created_by": "qm_user",
    "created_date_ms": 1700005000000,
}


def _make_sql_mock(call_results: list[list[dict]]):
    """Return a coroutine that yields successive call_results."""
    call_iter = iter(call_results)

    async def fake_run_sql_async(_token, _query, _params=None, **_kwargs):
        return next(call_iter)

    return fake_run_sql_async


def test_fetch_order_detail_returns_none_when_not_found(monkeypatch):
    monkeypatch.setattr(dal, "run_sql_async", _make_sql_mock([
        [],  # header — empty → not found
        [], [], [], [], [], [], [],
    ]))
    result = asyncio.run(dal.fetch_order_detail("token", order_id="NOPE"))
    assert result is None


def test_fetch_order_detail_returns_full_payload(monkeypatch):
    monkeypatch.setattr(dal, "run_sql_async", _make_sql_mock([
        [_HEADER_ROW],
        [_PHASE_ROW],
        [_MOVEMENT_ROW],
        [],  # comments
        [],  # downtime
        [],  # equipment
        [],  # inspections
        [_UD_ROW],
    ]))
    result = asyncio.run(dal.fetch_order_detail("token", order_id="PO-001"))
    assert result is not None
    assert result["order"]["process_order_id"] == "PO-001"
    assert result["order"]["status"] == "running"
    assert len(result["phases"]) == 1
    assert result["phases"][0]["setup_s"] == 120.0
    assert len(result["movements"]) == 1
    assert len(result["materials"]) == 1
    assert result["materials"][0]["material_id"] == "MAT-002"
    assert result["materials"][0]["total_qty"] == 100.0
    assert result["movement_summary"]["qty_issued_kg"] == 100.0
    assert result["movement_summary"]["qty_received_kg"] is None
    assert result["time_summary"]["setup_s"] == 120.0
    assert result["usage_decision"]["usage_decision_code"] == "A"
    assert result["usage_decision"]["quality_score"] == 95.0


def test_fetch_order_detail_no_usage_decision(monkeypatch):
    monkeypatch.setattr(dal, "run_sql_async", _make_sql_mock([
        [_HEADER_ROW],
        [], [], [], [], [], [],
        [],  # usage_decision empty
    ]))
    result = asyncio.run(dal.fetch_order_detail("token", order_id="PO-001"))
    assert result is not None
    assert result["usage_decision"] is None
