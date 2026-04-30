"""Unit tests for vessel_planning_dal — classifier, coerce helpers, derivation logic, series builder."""
import pytest

from backend.dal import vessel_planning_dal as dal

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
# _build_daily30d_series
# ---------------------------------------------------------------------------

_NOW_MS = 1_700_000_000_000
_MS_PER_DAY = 86_400_000


def test_build_daily30d_series_always_30_buckets():
    result = dal._build_daily30d_series([], _NOW_MS)
    assert len(result) == 30


def test_build_daily30d_series_zero_padded():
    result = dal._build_daily30d_series([], _NOW_MS)
    assert all(d["event_count"] == 0 for d in result)


def test_build_daily30d_series_fills_matching_bucket():
    first_bucket = result = dal._build_daily30d_series([], _NOW_MS)[0]["day_ms"]
    rows = [{"day_ms": first_bucket, "event_count": 7}]
    result = dal._build_daily30d_series(rows, _NOW_MS)
    hit = next(d for d in result if d["day_ms"] == first_bucket)
    assert hit["event_count"] == 7


def test_build_daily30d_series_ignores_out_of_range():
    ancient_day_ms = _NOW_MS - 60 * _MS_PER_DAY
    rows = [{"day_ms": ancient_day_ms, "event_count": 99}]
    result = dal._build_daily30d_series(rows, _NOW_MS)
    assert all(d["event_count"] == 0 for d in result)


def test_build_daily30d_series_accumulates_multiple_rows_same_bucket():
    first_bucket = dal._build_daily30d_series([], _NOW_MS)[0]["day_ms"]
    rows = [
        {"day_ms": first_bucket, "event_count": 3},
        {"day_ms": first_bucket, "event_count": 5},
    ]
    result = dal._build_daily30d_series(rows, _NOW_MS)
    hit = next(d for d in result if d["day_ms"] == first_bucket)
    assert hit["event_count"] == 8
