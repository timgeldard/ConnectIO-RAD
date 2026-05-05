"""Domain tests for process-order execution models."""

from shared_domain import ValueObject

from processorderhistory_backend.order_execution.domain.movements import (
    GoodsMovement,
    MovementQuantity,
    derive_materials,
    movement_summary,
)


def test_movement_quantity_is_value_object_and_normalizes_to_kg():
    quantity = MovementQuantity(1000.0, " g ")

    assert isinstance(quantity, ValueObject)
    assert quantity.normalized_uom == "G"
    assert quantity.to_kg() == 1.0
    assert quantity.material_summary_uom == "KG"


def test_goods_movement_from_row_defaults_missing_quantity():
    movement = GoodsMovement.from_row({"movement_type": "261", "material_id": "MAT-1"})

    assert movement.movement_type == "261"
    assert movement.material_id == "MAT-1"
    assert movement.quantity_kg == 0.0


def test_movement_summary_nets_issue_and_receipt_reversals():
    summary = movement_summary([
        {"movement_type": "261", "quantity": 100.0, "uom": "KG"},
        {"movement_type": "262", "quantity": 25.0, "uom": "KG"},
        {"movement_type": "101", "quantity": 1000.0, "uom": "G"},
        {"movement_type": "102", "quantity": 100.0, "uom": "G"},
    ])

    assert summary.qty_issued_kg == 75.0
    assert summary.qty_received_kg == 0.9
    assert summary.to_dict() == {"qty_issued_kg": 75.0, "qty_received_kg": 0.9}


def test_derive_materials_excludes_each_and_fully_reversed_components():
    materials = derive_materials([
        {"movement_type": "261", "material_id": "PACK", "material_name": "Box", "quantity": 10.0, "uom": "EA"},
        {"movement_type": "261", "material_id": "MAT-1", "material_name": "Sugar", "batch_id": "B1", "quantity": 2_000.0, "uom": "G"},
        {"movement_type": "262", "material_id": "MAT-1", "material_name": "Sugar", "batch_id": "B1", "quantity": 500.0, "uom": "G"},
        {"movement_type": "261", "material_id": "MAT-2", "material_name": "Salt", "batch_id": "B2", "quantity": 1.0, "uom": "KG"},
        {"movement_type": "262", "material_id": "MAT-2", "material_name": "Salt", "batch_id": "B2", "quantity": 1.0, "uom": "KG"},
    ])

    assert materials == [
        {
            "material_id": "MAT-1",
            "material_name": "Sugar",
            "batch_id": "B1",
            "total_qty": 1.5,
            "uom": "KG",
        }
    ]
