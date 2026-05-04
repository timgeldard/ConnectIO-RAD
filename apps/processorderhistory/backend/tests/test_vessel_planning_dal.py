"""Unit tests for vessel_planning_dal — classifier, coerce helpers, derivation logic."""
import pytest
from unittest.mock import patch

from backend.production_planning.dal import vessel_planning_dal as dal
from backend.config import vessel_capacity as vc
from backend.config.vessel_capacity import check_capacity, get_vessel_capacity

_TEST_CAP_CONFIG = [
    {"instrument_id": "TK-101", "min_vol": 500.0, "max_vol": 2000.0, "uom": "L", "plant_id": "RCN1"},
]

# ---------------------------------------------------------------------------
# _classify_state
# ---------------------------------------------------------------------------

def test_classify_state_running_po_overrides_status():
    assert dal._classify_state("AVAILABLE", "running") == "IN_USE"


def test_classify_state_running_po_with_no_status_to():
    assert dal._classify_state(None, "running") == "IN_USE"


def test_classify_state_in_use_keywords():
    for kw in ("IN USE", "IN-USE", "INUSE", "RUNNING", "OCCUPIED", "ACTIVE", "PRODUCTION", "PROCESS"):
        assert dal._classify_state(kw, None) == "IN_USE", f"expected IN_USE for {kw!r}"


def test_classify_state_in_use_keyword_mixed_case():
    assert dal._classify_state("currently Running", None) == "IN_USE"


def test_classify_state_dirty_keywords():
    for kw in ("DIRTY", "UNCLEAN", "CIP REQUIRED", "SOAKING", "RINSE", "AWAITING CLEAN"):
        assert dal._classify_state(kw, None) == "DIRTY", f"expected DIRTY for {kw!r}"


def test_classify_state_available_keywords():
    for kw in ("AVAILABLE", "CLEAN", "FREE", "READY", "IDLE", "EMPTY", "SANITISED", "SANITIZED", "CLEANED"):
        assert dal._classify_state(kw, None) == "AVAILABLE", f"expected AVAILABLE for {kw!r}"


def test_classify_state_unknown_unrecognised_text():
    assert dal._classify_state("STANDBY MODE", None) == "UNKNOWN"


def test_classify_state_none_status_no_order():
    assert dal._classify_state(None, None) == "UNKNOWN"


def test_classify_state_empty_string():
    assert dal._classify_state("", None) == "UNKNOWN"


def test_classify_state_non_running_order_uses_keyword():
    assert dal._classify_state("CLEAN", "completed") == "AVAILABLE"


# ---------------------------------------------------------------------------
# _coerce_int_ms
# ---------------------------------------------------------------------------

def test_coerce_int_ms_converts_string():
    assert dal._coerce_int_ms("1700000000000") == 1700000000000


def test_coerce_int_ms_converts_int():
    assert dal._coerce_int_ms(1700000000000) == 1700000000000


def test_coerce_int_ms_none_returns_none():
    assert dal._coerce_int_ms(None) is None


# ---------------------------------------------------------------------------
# _coerce_event_row
# ---------------------------------------------------------------------------

def test_coerce_event_row_normal():
    row = {
        "change_at_ms": "1700000000000",
        "instrument_id": "TK-101",
        "process_order_id": "PO-001",
        "material_id": "MAT-A",
    }
    result = dal._coerce_event_row(row)
    assert result["change_at_ms"] == 1700000000000
    assert result["instrument_id"] == "TK-101"
    assert result["process_order_id"] == "PO-001"
    assert result["material_id"] == "MAT-A"


def test_coerce_event_row_none_process_order():
    row = {"change_at_ms": None, "instrument_id": "TK-101", "process_order_id": None, "material_id": None}
    result = dal._coerce_event_row(row)
    assert result["change_at_ms"] == 0
    assert result["process_order_id"] is None
    assert result["material_id"] is None


def test_coerce_event_row_empty_po():
    row = {"change_at_ms": "0", "instrument_id": "X", "process_order_id": "", "material_id": ""}
    result = dal._coerce_event_row(row)
    assert result["process_order_id"] is None
    assert result["material_id"] is None


# ---------------------------------------------------------------------------
# _derive_planning_data — vessels
# ---------------------------------------------------------------------------

_LATEST_ROW = {
    "instrument_id": "TK-101",
    "equipment_type": "Tank",
    "status_from": "IN PROGRESS",
    "status_to": "CLEAN",
    "change_at_ms": 1700000000000,
    "process_order_id": None,
    "material_id": None,
    "material_name": None,
    "order_status": None,
}


def test_derive_vessel_state_available():
    vessels, _, _ = dal._derive_planning_data([_LATEST_ROW], [], [])
    assert len(vessels) == 1
    assert vessels[0]["state"] == "AVAILABLE"
    assert vessels[0]["instrument_id"] == "TK-101"


def test_derive_vessel_state_in_use_via_running_po():
    row = {**_LATEST_ROW, "status_to": "CLEAN", "order_status": "running", "process_order_id": "PO-999"}
    vessels, _, _ = dal._derive_planning_data([row], [], [])
    assert vessels[0]["state"] == "IN_USE"
    assert vessels[0]["current_po_id"] == "PO-999"


def test_derive_vessel_state_dirty():
    row = {**_LATEST_ROW, "status_to": "DIRTY"}
    vessels, _, _ = dal._derive_planning_data([row], [], [])
    assert vessels[0]["state"] == "DIRTY"
    assert vessels[0]["recommended_action"] == "Schedule CIP cleaning for TK-101"
    assert vessels[0]["action_priority"] == 2


def test_derive_vessel_skips_empty_instrument_id():
    bad = {**_LATEST_ROW, "instrument_id": ""}
    vessels, _, _ = dal._derive_planning_data([bad], [], [])
    assert vessels == []


# ---------------------------------------------------------------------------
# _derive_planning_data — affinity
# ---------------------------------------------------------------------------

def test_derive_affinity_counted_from_events():
    events = [
        {"instrument_id": "TK-101", "material_id": "MAT-A", "material_name": "Alpha", "change_at_ms": 0},
        {"instrument_id": "TK-101", "material_id": "MAT-A", "material_name": "Alpha", "change_at_ms": 0},
        {"instrument_id": "TK-102", "material_id": "MAT-A", "material_name": "Alpha", "change_at_ms": 0},
    ]
    vessel_row_a = {**_LATEST_ROW, "instrument_id": "TK-101"}
    vessel_row_b = {**_LATEST_ROW, "instrument_id": "TK-102"}
    vessels, _, _ = dal._derive_planning_data([vessel_row_a, vessel_row_b], events, [])
    tk101 = next(v for v in vessels if v["instrument_id"] == "TK-101")
    assert tk101["affinity_materials"][0]["material_id"] == "MAT-A"
    assert tk101["affinity_materials"][0]["use_count"] == 2


def test_derive_affinity_missing_ids_skipped():
    events = [{"instrument_id": "", "material_id": "MAT-A", "change_at_ms": 0}]
    vessels, _, _ = dal._derive_planning_data([_LATEST_ROW], events, [])
    tk101 = next(v for v in vessels if v["instrument_id"] == "TK-101")
    assert tk101["affinity_materials"] == []


# ---------------------------------------------------------------------------
# _derive_planning_data — released orders and feasibility
# ---------------------------------------------------------------------------

def _vessel(instrument_id, state, material_id=None):
    return {
        **_LATEST_ROW,
        "instrument_id": instrument_id,
        "status_to": {"AVAILABLE": "CLEAN", "DIRTY": "DIRTY", "IN_USE": "IN USE", "UNKNOWN": "STANDBY"}[state],
        "order_status": "running" if state == "IN_USE" else None,
        "material_id": material_id,
    }


def _released(po_id, material_id):
    return {
        "po_id": po_id,
        "material_id": material_id,
        "material_name": f"Material {material_id}",
        "plant_id": "RCN1",
        "scheduled_start_ms": None,
    }


def test_released_order_feasible_when_affinity_vessel_available():
    events = [
        {"instrument_id": "TK-101", "material_id": "MAT-A", "material_name": "Alpha", "change_at_ms": 0},
        {"instrument_id": "TK-101", "material_id": "MAT-A", "material_name": "Alpha", "change_at_ms": 0},
        {"instrument_id": "TK-101", "material_id": "MAT-A", "material_name": "Alpha", "change_at_ms": 0},
    ]
    _, orders, kpis = dal._derive_planning_data(
        [_vessel("TK-101", "AVAILABLE")], events, [_released("PO-1", "MAT-A")]
    )
    assert orders[0]["feasible"] is True
    assert orders[0]["constraint_type"] is None
    assert orders[0]["heuristic_confidence"] == "high"
    assert "TK-101" in orders[0]["likely_vessels"]
    assert kpis["constrained_po_count"] == 0


def test_released_order_constrained_dirty_vessel():
    events = [{"instrument_id": "TK-101", "material_id": "MAT-A", "material_name": "A", "change_at_ms": 0}]
    _, orders, kpis = dal._derive_planning_data(
        [_vessel("TK-101", "DIRTY")], events, [_released("PO-1", "MAT-A")]
    )
    assert orders[0]["feasible"] is False
    assert orders[0]["constraint_type"] == "dirty_vessel"
    assert kpis["constrained_po_count"] == 1
    assert kpis["unblock_action_count"] == 1


def test_released_order_constrained_in_use_vessel():
    events = [{"instrument_id": "TK-101", "material_id": "MAT-A", "material_name": "A", "change_at_ms": 0}]
    latest = {**_LATEST_ROW, "instrument_id": "TK-101", "status_to": "IN USE", "order_status": "running",
              "process_order_id": "PO-RUN"}
    _, orders, kpis = dal._derive_planning_data([latest], events, [_released("PO-1", "MAT-A")])
    assert orders[0]["feasible"] is False
    assert orders[0]["constraint_type"] == "in_use_vessel"
    assert kpis["unblock_action_count"] == 1


def test_released_order_no_affinity_constraint():
    _, orders, kpis = dal._derive_planning_data(
        [_vessel("TK-101", "AVAILABLE")], [], [_released("PO-1", "MAT-A")]
    )
    assert orders[0]["feasible"] is False
    assert orders[0]["constraint_type"] == "no_vessel"
    assert orders[0]["heuristic_confidence"] == "low"
    assert orders[0]["likely_vessels"] == []


def test_released_order_rank_is_one_based():
    _, orders, _ = dal._derive_planning_data([], [], [_released("PO-X", "MAT-Z")])
    assert orders[0]["rank"] == 1


# ---------------------------------------------------------------------------
# _derive_planning_data — KPIs
# ---------------------------------------------------------------------------

def test_kpis_vessel_counts():
    rows = [
        _vessel("TK-A", "AVAILABLE"),
        _vessel("TK-B", "DIRTY"),
        _vessel("TK-C", "IN_USE"),
        _vessel("TK-D", "UNKNOWN"),
    ]
    _, _, kpis = dal._derive_planning_data(rows, [], [])
    assert kpis["available_vessel_count"] == 1
    assert kpis["dirty_vessel_count"] == 1
    assert kpis["in_use_vessel_count"] == 1
    assert kpis["unknown_vessel_count"] == 1


def test_kpis_released_po_count():
    _, _, kpis = dal._derive_planning_data(
        [], [], [_released("PO-1", "M1"), _released("PO-2", "M2")]
    )
    assert kpis["released_po_count"] == 2


# ---------------------------------------------------------------------------
# _derive_planning_data — blocked_orders per vessel
# ---------------------------------------------------------------------------

def test_blocked_orders_populated_for_dirty_vessel():
    events = [{"instrument_id": "TK-101", "material_id": "MAT-A", "material_name": "A", "change_at_ms": 0}]
    vessels, _, _ = dal._derive_planning_data(
        [_vessel("TK-101", "DIRTY")], events, [_released("PO-1", "MAT-A")]
    )
    tk = next(v for v in vessels if v["instrument_id"] == "TK-101")
    assert len(tk["blocked_orders"]) == 1
    assert tk["blocked_orders"][0]["po_id"] == "PO-1"


def test_blocked_orders_capped_at_ten():
    events = [{"instrument_id": "TK-X", "material_id": "MAT-X", "material_name": "X", "change_at_ms": 0}] * 20
    released = [_released(f"PO-{i}", "MAT-X") for i in range(15)]
    vessels, _, _ = dal._derive_planning_data([_vessel("TK-X", "DIRTY")], events, released)
    tk = next(v for v in vessels if v["instrument_id"] == "TK-X")
    assert len(tk["blocked_orders"]) == 10


# ---------------------------------------------------------------------------
# _state_reason
# ---------------------------------------------------------------------------

def test_state_reason_running_po():
    reason = dal._state_reason("IN_USE", "CLEAN", "running", "PO-123")
    assert "PO-123" in reason
    assert "Running" in reason


def test_state_reason_running_po_unknown_when_no_po_id():
    reason = dal._state_reason("IN_USE", "IN USE", "running", None)
    assert "unknown" in reason.lower()


def test_state_reason_in_use_keyword():
    reason = dal._state_reason("IN_USE", "IN USE", None, None)
    assert "in-use" in reason.lower() or "in_use" in reason.lower() or "in use" in reason.lower()


def test_state_reason_dirty_keyword():
    reason = dal._state_reason("DIRTY", "DIRTY", None, None)
    assert "dirty" in reason.lower()


def test_state_reason_available_keyword():
    reason = dal._state_reason("AVAILABLE", "CLEAN", None, None)
    assert "available" in reason.lower()


def test_state_reason_unknown_no_status_to():
    reason = dal._state_reason("UNKNOWN", None, None, None)
    assert reason  # non-empty


def test_state_reason_unknown_unrecognised_status():
    reason = dal._state_reason("UNKNOWN", "STANDBY MODE", None, None)
    assert "STANDBY MODE" in reason


# ---------------------------------------------------------------------------
# Evidence fields on released orders
# ---------------------------------------------------------------------------

def _events_with_ts(*pairs):
    """Build event rows: pairs of (instrument_id, material_id, change_at_ms)."""
    return [
        {"instrument_id": iid, "material_id": mid, "material_name": f"Mat-{mid}", "change_at_ms": ts}
        for iid, mid, ts in pairs
    ]


def test_evidence_affinity_count_matches_cooccurrence():
    events = _events_with_ts(
        ("TK-101", "MAT-A", 1000),
        ("TK-101", "MAT-A", 2000),
        ("TK-101", "MAT-A", 3000),
    )
    _, orders, _ = dal._derive_planning_data(
        [_vessel("TK-101", "AVAILABLE")], events, [_released("PO-1", "MAT-A")]
    )
    assert orders[0]["evidence_affinity_count"] == 3


def test_evidence_affinity_rank_is_1_for_top_vessel():
    events = _events_with_ts(
        ("TK-101", "MAT-A", 1000),
        ("TK-101", "MAT-A", 2000),
        ("TK-102", "MAT-A", 3000),
    )
    vessels = [_vessel("TK-101", "AVAILABLE"), _vessel("TK-102", "AVAILABLE")]
    _, orders, _ = dal._derive_planning_data(vessels, events, [_released("PO-1", "MAT-A")])
    assert orders[0]["evidence_affinity_rank"] == 1
    assert orders[0]["recommended_vessel"] == "TK-101"


def test_evidence_candidate_vessel_count():
    events = _events_with_ts(
        ("TK-101", "MAT-A", 1000),
        ("TK-102", "MAT-A", 2000),
        ("TK-103", "MAT-A", 3000),
    )
    vessels = [_vessel("TK-101", "AVAILABLE"), _vessel("TK-102", "AVAILABLE"), _vessel("TK-103", "AVAILABLE")]
    _, orders, _ = dal._derive_planning_data(vessels, events, [_released("PO-1", "MAT-A")])
    assert orders[0]["evidence_candidate_vessel_count"] == 3


def test_evidence_last_seen_at_ms_is_max_timestamp():
    events = _events_with_ts(
        ("TK-101", "MAT-A", 1000),
        ("TK-101", "MAT-A", 9000),
        ("TK-101", "MAT-A", 5000),
    )
    _, orders, _ = dal._derive_planning_data(
        [_vessel("TK-101", "AVAILABLE")], events, [_released("PO-1", "MAT-A")]
    )
    assert orders[0]["evidence_last_seen_at_ms"] == 9000


def test_evidence_source_affinity_history_when_data_exists():
    events = _events_with_ts(("TK-101", "MAT-A", 1000))
    _, orders, _ = dal._derive_planning_data(
        [_vessel("TK-101", "AVAILABLE")], events, [_released("PO-1", "MAT-A")]
    )
    assert orders[0]["evidence_source"] == "affinity_history"


def test_evidence_source_no_affinity_data_when_no_history():
    _, orders, _ = dal._derive_planning_data(
        [_vessel("TK-101", "AVAILABLE")], [], [_released("PO-1", "MAT-A")]
    )
    assert orders[0]["evidence_source"] == "no_affinity_data"


def test_evidence_notes_contains_capacity_note_when_qty_unknown():
    events = _events_with_ts(("TK-101", "MAT-A", 1000))
    _, orders, _ = dal._derive_planning_data(
        [_vessel("TK-101", "AVAILABLE")], events, [_released("PO-1", "MAT-A")]
    )
    assert any("capacity" in n.lower() for n in orders[0]["evidence_notes"])


def test_evidence_affinity_rank_none_when_no_affinity():
    _, orders, _ = dal._derive_planning_data([], [], [_released("PO-1", "MAT-Z")])
    assert orders[0]["evidence_affinity_rank"] is None


def test_evidence_last_seen_none_when_no_history():
    _, orders, _ = dal._derive_planning_data([], [], [_released("PO-1", "MAT-Z")])
    assert orders[0]["evidence_last_seen_at_ms"] is None


# ---------------------------------------------------------------------------
# Capacity config helpers
# ---------------------------------------------------------------------------

def test_check_capacity_within_range():
    with patch.object(vc, "VESSEL_CAPACITY", _TEST_CAP_CONFIG):
        fits, note = check_capacity("TK-101", 1000.0, plant_id="RCN1")
    assert fits is True
    assert "fits" in note


def test_check_capacity_over_max_excluded():
    with patch.object(vc, "VESSEL_CAPACITY", _TEST_CAP_CONFIG):
        fits, note = check_capacity("TK-101", 3000.0, plant_id="RCN1")
    assert fits is False
    assert "excluded" in note


def test_check_capacity_under_min_excluded():
    with patch.object(vc, "VESSEL_CAPACITY", _TEST_CAP_CONFIG):
        fits, note = check_capacity("TK-101", 10.0, plant_id="RCN1")
    assert fits is False
    assert "excluded" in note


def test_check_capacity_no_config_degrades_gracefully():
    fits, note = check_capacity("TK-UNKNOWN", 1000.0)
    assert fits is True
    assert "no capacity config" in note


def test_get_vessel_capacity_plant_specific_wins():
    global_entry = {"instrument_id": "TK-101", "min_vol": 100.0, "max_vol": 5000.0, "uom": "L"}
    config = [_TEST_CAP_CONFIG[0], global_entry]
    with patch.object(vc, "VESSEL_CAPACITY", config):
        result = get_vessel_capacity("TK-101", plant_id="RCN1")
    assert result is not None
    assert result["min_vol"] == 500.0


# ---------------------------------------------------------------------------
# New vessel evidence fields
# ---------------------------------------------------------------------------

def test_vessel_state_reason_present_on_every_vessel():
    rows = [
        _vessel("TK-A", "AVAILABLE"),
        _vessel("TK-B", "DIRTY"),
        _vessel("TK-C", "IN_USE"),
        _vessel("TK-D", "UNKNOWN"),
    ]
    vessels, _, _ = dal._derive_planning_data(rows, [], [])
    for v in vessels:
        assert "state_reason" in v
        assert v["state_reason"]  # non-empty string


def test_vessel_blocked_order_count_matches_blocked_orders_len():
    events = _events_with_ts(
        ("TK-101", "MAT-A", 1000),
        ("TK-101", "MAT-A", 2000),
    )
    released = [_released("PO-1", "MAT-A"), _released("PO-2", "MAT-A")]
    vessels, _, _ = dal._derive_planning_data([_vessel("TK-101", "DIRTY")], events, released)
    tk = next(v for v in vessels if v["instrument_id"] == "TK-101")
    assert tk["blocked_order_count"] == len(tk["blocked_orders"])
    assert tk["blocked_order_count"] == 2


def test_vessel_top_affinity_material_count():
    events = _events_with_ts(
        ("TK-101", "MAT-A", 1000),
        ("TK-101", "MAT-B", 2000),
        ("TK-101", "MAT-C", 3000),
    )
    vessels, _, _ = dal._derive_planning_data([_vessel("TK-101", "AVAILABLE")], events, [])
    tk = next(v for v in vessels if v["instrument_id"] == "TK-101")
    assert tk["top_affinity_material_count"] == 3


def test_vessel_action_reason_includes_waiting_count_for_dirty():
    events = _events_with_ts(("TK-101", "MAT-A", 1000))
    released = [_released("PO-1", "MAT-A"), _released("PO-2", "MAT-A")]
    vessels, _, _ = dal._derive_planning_data([_vessel("TK-101", "DIRTY")], events, released)
    tk = next(v for v in vessels if v["instrument_id"] == "TK-101")
    assert tk["action_reason"] is not None
    assert "2" in tk["action_reason"] or "waiting" in tk["action_reason"].lower()


def test_vessel_action_reason_none_for_available_vessel():
    vessels, _, _ = dal._derive_planning_data([_vessel("TK-101", "AVAILABLE")], [], [])
    tk = next(v for v in vessels if v["instrument_id"] == "TK-101")
    assert tk["action_reason"] is None


def test_vessel_state_reason_running_po_contains_po_id():
    row = {**_LATEST_ROW, "order_status": "running", "process_order_id": "PO-XYZ", "status_to": "CLEAN"}
    vessels, _, _ = dal._derive_planning_data([row], [], [])
    tk = vessels[0]
    assert "PO-XYZ" in tk["state_reason"]


def test_vessel_blocked_order_count_zero_when_no_blocked():
    vessels, _, _ = dal._derive_planning_data([_vessel("TK-101", "AVAILABLE")], [], [])
    tk = vessels[0]
    assert tk["blocked_order_count"] == 0
