"""Domain tests for manufacturing equipment insights."""

from datetime import datetime, timezone as dt_timezone

from processorderhistory_backend.manufacturing_analytics.domain.equipment import (
    aggregate_by_type,
    build_activity_daily,
    build_state_distribution,
    classify_state,
    derive_equipment_insights,
)


def test_aggregate_by_type_groups_known_subtypes():
    result = aggregate_by_type([
        {"equipment_sub_type": "Fixed", "instrument_count": 2},
        {"equipment_sub_type": "Mobile", "instrument_count": 3},
        {"equipment_sub_type": "Connected Scale", "instrument_count": 4},
    ])

    totals = {row["equipment_type"]: row["instrument_count"] for row in result}
    assert totals == {"Vessel": 5, "Scale": 4}


def test_derive_equipment_insights_calculates_percentages():
    result = derive_equipment_insights([
        {"equipment_type": "Vessel", "instrument_count": 3},
        {"equipment_type": "Scale", "instrument_count": 1},
    ])

    assert result["total_instrument_count"] == 4
    assert result["type_distribution"][0]["pct"] == 75.0


def test_classify_state_and_distribution_use_stable_buckets():
    assert classify_state("Awaiting Clean") == "dirty"
    assert classify_state("In Production") == "in_use"

    distribution = build_state_distribution([
        {"status_to": "In Production"},
        {"status_to": "Clean"},
        {"status_to": None},
    ])

    assert [row["state"] for row in distribution] == ["in_use", "dirty", "available", "unknown"]
    assert [row["count"] for row in distribution] == [1, 0, 1, 1]


def test_build_activity_daily_zero_pads_local_day_series():
    now_ms = int(datetime(2026, 4, 30, 12, tzinfo=dt_timezone.utc).timestamp() * 1000)

    result = build_activity_daily([], now_ms)

    assert len(result) == 30
    assert all(row["active_instruments"] == 0 for row in result)
