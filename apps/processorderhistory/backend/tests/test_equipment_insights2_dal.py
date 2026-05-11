"""Tests for Equipment Insights v2 domain functions and DAL integration."""
import pytest
from datetime import datetime, timezone as dt_timezone
from unittest.mock import AsyncMock, patch

from processorderhistory_backend.manufacturing_analytics.domain.equipment import (
    build_equipment_register,
    build_heatmap,
    build_kpis,
    build_ttc_trend,
    build_type_agg,
    compute_per_instrument_metrics,
    group_events_by_instrument,
)
from processorderhistory_backend.manufacturing_analytics.dal.equipment_insights2_dal import (
    fetch_equipment_insights2,
)


from shared_manufacturing import test_data

# ---------------------------------------------------------------------------
# Fixtures / helpers
# ---------------------------------------------------------------------------

_NOW_MS = int(datetime(2024, 6, 15, 12, 0, 0, tzinfo=dt_timezone.utc).timestamp() * 1000)
_HOUR_MS = 60 * 60 * 1_000
_DAY_MS = 24 * _HOUR_MS


def _event(instrument_id: str, status_to: str, offset_ms: int) -> dict:
    """Build a raw event row relative to _NOW_MS (negative = in the past)."""
    return {
        "instrument_id": instrument_id,
        "status_to": status_to,
        "change_at_ms": _NOW_MS + offset_ms,
    }


def _inst(instrument_id: str, eq_type: str = "Vessel") -> dict:
    plant = test_data.PLANTS[0]
    return {"INSTRUMENT_ID": instrument_id, "EQUIPMENT_TYPE": eq_type, "EQUIPMENT_SUB_TYPE": "Fixed", "PLANT_ID": plant}


# ---------------------------------------------------------------------------
# group_events_by_instrument
# ---------------------------------------------------------------------------


def test_group_events_by_instrument_partitions_correctly():
    rows = [
        _event("I1", "CLEAN", -200),
        _event("I2", "DIRTY", -100),
        _event("I1", "DIRTY", -50),
    ]
    result = group_events_by_instrument(rows)
    assert set(result.keys()) == {"I1", "I2"}
    assert len(result["I1"]) == 2
    assert len(result["I2"]) == 1


def test_group_events_ignores_empty_instrument_id():
    rows = [{"instrument_id": "", "status_to": "CLEAN", "change_at_ms": _NOW_MS}]
    assert group_events_by_instrument(rows) == {}


# ---------------------------------------------------------------------------
# compute_per_instrument_metrics — TTC
# ---------------------------------------------------------------------------


def test_ttc_single_complete_cycle():
    events = [
        _event("I1", "DIRTY", -3 * _HOUR_MS),     # went dirty 3h ago
        _event("I1", "AVAILABLE", -1 * _HOUR_MS),  # cleaned 1h ago → TTC = 2h = 120 min
    ]
    result = compute_per_instrument_metrics(events, _NOW_MS)
    assert result["ttc_min"] == pytest.approx(120.0, abs=0.5)


def test_ttc_no_complete_cycle_returns_zero():
    events = [_event("I1", "DIRTY", -2 * _HOUR_MS)]
    result = compute_per_instrument_metrics(events, _NOW_MS)
    assert result["ttc_min"] == 0.0


def test_ttc_multiple_cycles_averaged():
    events = [
        _event("I1", "DIRTY",     -8 * _HOUR_MS),
        _event("I1", "AVAILABLE", -6 * _HOUR_MS),  # cycle 1: 2h = 120 min
        _event("I1", "DIRTY",     -4 * _HOUR_MS),
        _event("I1", "AVAILABLE", -3 * _HOUR_MS),  # cycle 2: 1h = 60 min
    ]
    result = compute_per_instrument_metrics(events, _NOW_MS)
    assert result["ttc_min"] == pytest.approx(90.0, abs=0.5)


# ---------------------------------------------------------------------------
# compute_per_instrument_metrics — utilisation
# ---------------------------------------------------------------------------


def test_utilisation_half_day_in_use():
    # In-use for 12 of 168 hours → ~7.1%
    events = [
        _event("I1", "IN USE",    -4 * _DAY_MS),
        _event("I1", "AVAILABLE", -4 * _DAY_MS + 12 * _HOUR_MS),
    ]
    result = compute_per_instrument_metrics(events, _NOW_MS)
    expected = 12 / (7 * 24) * 100
    assert result["utilisation_pct"] == pytest.approx(expected, abs=0.5)


def test_utilisation_no_in_use_events_is_zero():
    events = [_event("I1", "AVAILABLE", -_DAY_MS)]
    result = compute_per_instrument_metrics(events, _NOW_MS)
    assert result["utilisation_pct"] == 0.0


# ---------------------------------------------------------------------------
# compute_per_instrument_metrics — dirty age
# ---------------------------------------------------------------------------


def test_dirty_age_currently_dirty():
    events = [_event("I1", "DIRTY", -2 * _HOUR_MS)]
    result = compute_per_instrument_metrics(events, _NOW_MS)
    assert result["dirty_age_min"] == pytest.approx(120.0, abs=1.0)


def test_dirty_age_not_dirty_returns_none():
    events = [_event("I1", "AVAILABLE", -_HOUR_MS)]
    result = compute_per_instrument_metrics(events, _NOW_MS)
    assert result["dirty_age_min"] is None


# ---------------------------------------------------------------------------
# compute_per_instrument_metrics — last clean
# ---------------------------------------------------------------------------


def test_last_clean_ms_tracks_most_recent_clean():
    clean_ms = _NOW_MS - 3 * _HOUR_MS
    events = [
        _event("I1", "AVAILABLE", -5 * _HOUR_MS),
        _event("I1", "AVAILABLE", -3 * _HOUR_MS),
    ]
    result = compute_per_instrument_metrics(events, _NOW_MS)
    assert result["last_clean_ms"] == clean_ms


def test_last_clean_ms_zero_if_never_cleaned():
    events = [_event("I1", "DIRTY", -_HOUR_MS)]
    result = compute_per_instrument_metrics(events, _NOW_MS)
    assert result["last_clean_ms"] == 0


# ---------------------------------------------------------------------------
# build_ttc_trend
# ---------------------------------------------------------------------------


def test_ttc_trend_length_is_14():
    result = build_ttc_trend({}, _NOW_MS)
    assert len(result) == 14


def test_ttc_trend_all_zeros_when_no_cycles():
    events_by_instrument = {"I1": [_event("I1", "DIRTY", -_HOUR_MS)]}
    result = build_ttc_trend(events_by_instrument, _NOW_MS)
    assert all(v == 0.0 for v in result)


def test_ttc_trend_today_bucket_populated():
    # Cycle completed 60 minutes ago → goes into today's bucket (index 13)
    events_by_instrument = {"I1": [
        _event("I1", "DIRTY",     -2 * _HOUR_MS),
        _event("I1", "AVAILABLE", -1 * _HOUR_MS),  # 60 min TTC, today
    ]}
    result = build_ttc_trend(events_by_instrument, _NOW_MS)
    assert result[13] == pytest.approx(60.0, abs=0.5)


# ---------------------------------------------------------------------------
# build_heatmap
# ---------------------------------------------------------------------------


def test_heatmap_shape_is_7x24():
    result = build_heatmap([], 10, _NOW_MS)
    assert len(result) == 7
    assert all(len(row) == 24 for row in result)


def test_heatmap_all_zeros_for_empty_events():
    result = build_heatmap([], 10, _NOW_MS)
    assert all(v == 0.0 for row in result for v in row)


def test_heatmap_normalises_by_total_instruments():
    # One instrument goes IN USE at _NOW_MS - 1 hour (still within 7-day window)
    # _NOW_MS = 2024-06-15 12:00 UTC (Saturday), local hour = 11
    events = [_event("I1", "IN USE", -_HOUR_MS)]
    result = build_heatmap(events, total_instruments=2, now_ms=_NOW_MS, tz_name="UTC")
    # 1 of 2 instruments → 50.0%
    total_active = sum(v for row in result for v in row)
    assert total_active == pytest.approx(50.0, abs=0.1)


def test_heatmap_ignores_events_older_than_7_days():
    events = [_event("I1", "IN USE", -8 * _DAY_MS)]
    result = build_heatmap(events, total_instruments=1, now_ms=_NOW_MS)
    assert all(v == 0.0 for row in result for v in row)


# ---------------------------------------------------------------------------
# build_equipment_register
# ---------------------------------------------------------------------------


def test_register_defaults_for_missing_data():
    inst = _inst("I1")
    item = build_equipment_register([inst], {}, {})[0]
    assert item["ftr_pct"] == 100.0
    assert item["cal_due_days"] is None
    assert item["faults_7d"] == 0
    assert item["anomaly"] is False
    assert item["criticality"] == "C"


def test_register_applies_state_from_map():
    inst = _inst("I1")
    items = build_equipment_register([inst], {"I1": "DIRTY"}, {})
    assert items[0]["state"] == "dirty"


def test_register_falls_back_instrument_id_as_name():
    inst = _inst("I_NONAME")
    items = build_equipment_register([inst], {}, {})
    assert items[0]["name"] == "I_NONAME"


def test_register_unknown_state_when_no_event():
    inst = _inst("I1")
    items = build_equipment_register([inst], {}, {})
    assert items[0]["state"] == "unknown"


# ---------------------------------------------------------------------------
# build_type_agg
# ---------------------------------------------------------------------------


def test_type_agg_groups_correctly():
    register = [
        {"type": "Vessel", "ttc_min": 60.0, "utilisation_pct": 50.0, "state": "dirty"},
        {"type": "Vessel", "ttc_min": 30.0, "utilisation_pct": 30.0, "state": "available"},
        {"type": "Scale",  "ttc_min": 10.0, "utilisation_pct": 10.0, "state": "in_use"},
    ]
    result = build_type_agg(register)
    vessel = next(r for r in result if r["type"] == "Vessel")
    scale  = next(r for r in result if r["type"] == "Scale")
    assert vessel["count"] == 2
    assert vessel["dirty"] == 1
    assert vessel["avg_ttc_min"] == pytest.approx(45.0)
    assert scale["count"] == 1


# ---------------------------------------------------------------------------
# build_kpis
# ---------------------------------------------------------------------------


def test_kpis_dirty_count():
    register = [
        {"state": "dirty", "ttc_min": 60.0, "utilisation_pct": 50.0, "dirty_age_min": 300.0},
        {"state": "dirty", "ttc_min": 0.0,  "utilisation_pct": 20.0, "dirty_age_min": 100.0},
        {"state": "available", "ttc_min": 45.0, "utilisation_pct": 30.0, "dirty_age_min": None},
    ]
    kpis = build_kpis(register)
    assert kpis["dirty_count"] == 2
    assert kpis["dirty_over_4h"] == 1  # only the 300-min item
    assert kpis["cal_overdue"] == 0
    assert kpis["anomaly_count"] == 0


def test_kpis_avg_ttc_excludes_zero():
    register = [
        {"state": "available", "ttc_min": 60.0, "utilisation_pct": 50.0, "dirty_age_min": None},
        {"state": "available", "ttc_min": 0.0,  "utilisation_pct": 50.0, "dirty_age_min": None},
    ]
    kpis = build_kpis(register)
    # Only one non-zero TTC → avg should be 60, not 30
    assert kpis["avg_ttc_min"] == pytest.approx(60.0)


def test_kpis_empty_register():
    kpis = build_kpis([])
    assert kpis["dirty_count"] == 0
    assert kpis["avg_ttc_min"] == 0.0


# ---------------------------------------------------------------------------
# fetch_equipment_insights2 — integration smoke test
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_fetch_equipment_insights2_smoke():
    """Smoke test: mocked SQL returns the full payload with data_available=True."""
    plant = test_data.PLANTS[0]
    instruments = [
        {"INSTRUMENT_ID": "V01", "EQUIPMENT_TYPE": "Vessel", "EQUIPMENT_SUB_TYPE": "Fixed", "PLANT_ID": plant},
        {"INSTRUMENT_ID": "V02", "EQUIPMENT_TYPE": "Vessel", "EQUIPMENT_SUB_TYPE": "Fixed", "PLANT_ID": plant},
    ]
    state_rows = [
        {"instrument_id": "V01", "status_to": "IN USE"},
        {"instrument_id": "V02", "status_to": "DIRTY"},
    ]
    event_rows = [
        {"instrument_id": "V02", "status_to": "DIRTY",     "change_at_ms": _NOW_MS - 3 * _HOUR_MS},
        {"instrument_id": "V02", "status_to": "AVAILABLE", "change_at_ms": _NOW_MS - 1 * _HOUR_MS},
        {"instrument_id": "V02", "status_to": "DIRTY",     "change_at_ms": _NOW_MS - 30 * 60 * 1000},
    ]

    with patch(
        "processorderhistory_backend.manufacturing_analytics.dal.equipment_insights2_dal._q_instrument_master",
        new=AsyncMock(return_value=instruments),
    ), patch(
        "processorderhistory_backend.manufacturing_analytics.dal.equipment_insights2_dal._q_current_states",
        new=AsyncMock(return_value=state_rows),
    ), patch(
        "processorderhistory_backend.manufacturing_analytics.dal.equipment_insights2_dal._q_event_timeline",
        new=AsyncMock(return_value=event_rows),
    ):
        result = await fetch_equipment_insights2("mock-token", plant_id=plant)

    assert result["data_available"] is True
    assert len(result["equipment"]) == 2
    assert len(result["heatmap"]) == 7
    assert all(len(row) == 24 for row in result["heatmap"])
    assert len(result["ttc_trend"]) == 14
    assert len(result["ftr_trend"]) == 14
    assert result["cal_register"] == []
    assert result["anomalies"] == []
    # V02 is dirty → should appear in cleaning_backlog
    assert any(e["id"] == "V02" for e in result["cleaning_backlog"])
    # KPIs should reflect 1 dirty instrument
    assert result["kpis"]["dirty_count"] == 1
