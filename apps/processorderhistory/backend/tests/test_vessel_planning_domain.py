"""Domain tests for vessel planning heuristics."""

from backend.production_planning.domain.vessels import classify_state, derive_planning_data


def _vessel_row(instrument_id: str, status_to: str, *, order_status: str | None = None) -> dict:
    return {
        "instrument_id": instrument_id,
        "equipment_type": "Tank",
        "status_from": None,
        "status_to": status_to,
        "change_at_ms": 1_700_000_000_000,
        "process_order_id": "PO-RUN" if order_status == "running" else None,
        "material_id": None,
        "material_name": None,
        "order_status": order_status,
    }


def test_classify_state_running_order_overrides_clean_status():
    assert classify_state("CLEAN", "running") == "IN_USE"


def test_classify_state_uses_status_keywords():
    assert classify_state("CIP REQUIRED", None) == "DIRTY"
    assert classify_state("READY", None) == "AVAILABLE"
    assert classify_state("STANDBY", None) == "UNKNOWN"


def test_derive_planning_data_recommends_available_affinity_vessel():
    vessels, orders, kpis = derive_planning_data(
        [_vessel_row("TK-101", "CLEAN")],
        [
            {"instrument_id": "TK-101", "material_id": "MAT-A", "material_name": "Alpha", "change_at_ms": 1000},
            {"instrument_id": "TK-101", "material_id": "MAT-A", "material_name": "Alpha", "change_at_ms": 2000},
        ],
        [{"po_id": "PO-1", "material_id": "MAT-A", "material_name": "Alpha", "plant_id": "RCN1"}],
    )

    assert vessels[0]["state"] == "AVAILABLE"
    assert orders[0]["feasible"] is True
    assert orders[0]["recommended_vessel"] == "TK-101"
    assert orders[0]["evidence_last_seen_at_ms"] == 2000
    assert kpis["constrained_po_count"] == 0


def test_derive_planning_data_marks_dirty_affinity_vessel_constrained():
    vessels, orders, kpis = derive_planning_data(
        [_vessel_row("TK-101", "DIRTY")],
        [{"instrument_id": "TK-101", "material_id": "MAT-A", "material_name": "Alpha", "change_at_ms": 1000}],
        [{"po_id": "PO-1", "material_id": "MAT-A", "material_name": "Alpha", "plant_id": "RCN1"}],
    )

    assert orders[0]["feasible"] is False
    assert orders[0]["constraint_type"] == "dirty_vessel"
    assert vessels[0]["blocked_order_count"] == 1
    assert kpis["unblock_action_count"] == 1
