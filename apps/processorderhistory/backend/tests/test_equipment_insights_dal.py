"""Tests for equipment_insights_dal — pure Python derivation helpers."""
import pytest
from unittest.mock import AsyncMock, patch
from datetime import datetime, timezone as dt_timezone

from backend.dal.equipment_insights_dal import (
    _aggregate_by_type,
    _derive_equipment_insights,
    _classify_state,
    _build_state_distribution,
    _build_activity_daily,
    _build_activity_hourly,
    fetch_equipment_insights,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _row(equipment_type, count):
    return {"equipment_type": equipment_type, "instrument_count": count}


def _sub_row(sub_type, count):
    return {"equipment_sub_type": sub_type, "instrument_count": count}


def _state_row(status_to):
    return {"instrument_id": "I1", "status_to": status_to}


_FIXED_NOW_MS = int(datetime(2024, 6, 15, 12, 0, 0, tzinfo=dt_timezone.utc).timestamp() * 1000)


# ---------------------------------------------------------------------------
# _derive_equipment_insights
# ---------------------------------------------------------------------------


def test_total_instrument_count_sums_all_rows():
    rows = [_row("Bioreactor", 10), _row("Tank", 5), _row("Skid", 3)]
    result = _derive_equipment_insights(rows)
    assert result["total_instrument_count"] == 18


def test_type_distribution_length_matches_input():
    rows = [_row("Bioreactor", 10), _row("Tank", 5)]
    result = _derive_equipment_insights(rows)
    assert len(result["type_distribution"]) == 2


def test_type_distribution_preserves_order():
    rows = [_row("Bioreactor", 10), _row("Tank", 5), _row("Skid", 3)]
    result = _derive_equipment_insights(rows)
    types = [e["equipment_type"] for e in result["type_distribution"]]
    assert types == ["Bioreactor", "Tank", "Skid"]


def test_pct_sums_to_100_for_clean_data():
    rows = [_row("Bioreactor", 50), _row("Tank", 50)]
    result = _derive_equipment_insights(rows)
    total_pct = sum(e["pct"] for e in result["type_distribution"])
    assert abs(total_pct - 100.0) < 0.1


def test_pct_rounds_to_one_decimal():
    rows = [_row("A", 1), _row("B", 2)]
    result = _derive_equipment_insights(rows)
    for entry in result["type_distribution"]:
        pct_str = str(entry["pct"])
        decimal_places = len(pct_str.split(".")[-1]) if "." in pct_str else 0
        assert decimal_places <= 1


def test_pct_correct_value():
    rows = [_row("Bioreactor", 80), _row("Tank", 20)]
    result = _derive_equipment_insights(rows)
    dist = {e["equipment_type"]: e["pct"] for e in result["type_distribution"]}
    assert dist["Bioreactor"] == 80.0
    assert dist["Tank"] == 20.0


def test_count_field_matches_input():
    rows = [_row("Bioreactor", 42)]
    result = _derive_equipment_insights(rows)
    assert result["type_distribution"][0]["count"] == 42


def test_empty_rows_returns_zero_total():
    result = _derive_equipment_insights([])
    assert result["total_instrument_count"] == 0
    assert result["type_distribution"] == []


def test_empty_rows_pct_is_zero_not_division_error():
    """Division by zero must not raise — pct should be 0.0 when total is 0."""
    result = _derive_equipment_insights([])
    assert result["total_instrument_count"] == 0


def test_single_row_pct_is_100():
    rows = [_row("Bioreactor", 7)]
    result = _derive_equipment_insights(rows)
    assert result["type_distribution"][0]["pct"] == 100.0


def test_null_equipment_type_coerced_to_unknown():
    rows = [{"equipment_type": None, "instrument_count": 3}]
    result = _derive_equipment_insights(rows)
    assert result["type_distribution"][0]["equipment_type"] == "Unknown"


def test_null_instrument_count_coerced_to_zero():
    rows = [{"equipment_type": "Tank", "instrument_count": None}]
    result = _derive_equipment_insights(rows)
    assert result["type_distribution"][0]["count"] == 0
    assert result["total_instrument_count"] == 0


def test_string_instrument_count_coerced():
    """Databricks may return numeric fields as strings — coercion must handle this."""
    rows = [{"equipment_type": "Bioreactor", "instrument_count": "15"}]
    result = _derive_equipment_insights(rows)
    assert result["total_instrument_count"] == 15
    assert result["type_distribution"][0]["count"] == 15


# ---------------------------------------------------------------------------
# _aggregate_by_type
# ---------------------------------------------------------------------------


def test_aggregate_vessel_subtypes_merge_into_vessel():
    rows = [_sub_row("Fixed", 37), _sub_row("Mobile", 61), _sub_row("Mobile-FixBin", 81), _sub_row("ZIBC", 15)]
    result = _aggregate_by_type(rows)
    totals = {r["equipment_type"]: r["instrument_count"] for r in result}
    assert totals["Vessel"] == 194


def test_aggregate_scale_subtypes_merge_into_scale():
    rows = [_sub_row("Connected Scale", 45), _sub_row("Manual Scale", 36)]
    result = _aggregate_by_type(rows)
    totals = {r["equipment_type"]: r["instrument_count"] for r in result}
    assert totals["Scale"] == 81


def test_aggregate_auxiliary_subtypes_merge():
    rows = [
        _sub_row("Bucket", 29), _sub_row("Buckets", 2),
        _sub_row("CCP Screen", 33), _sub_row("Other", 1), _sub_row("Pump", 14),
    ]
    result = _aggregate_by_type(rows)
    totals = {r["equipment_type"]: r["instrument_count"] for r in result}
    assert totals["Auxiliary Equipment"] == 79


def test_aggregate_null_subtype_becomes_uncategorised():
    rows = [_sub_row(None, 47), _sub_row(None, 32)]
    result = _aggregate_by_type(rows)
    totals = {r["equipment_type"]: r["instrument_count"] for r in result}
    assert totals["Uncategorised"] == 79


def test_aggregate_unknown_subtype_becomes_uncategorised():
    rows = [_sub_row("SomeNewType", 10)]
    result = _aggregate_by_type(rows)
    totals = {r["equipment_type"]: r["instrument_count"] for r in result}
    assert totals["Uncategorised"] == 10


def test_aggregate_sorted_descending_by_count():
    rows = [_sub_row("Fixed", 37), _sub_row("Connected Scale", 45), _sub_row("Bucket", 10)]
    result = _aggregate_by_type(rows)
    counts = [r["instrument_count"] for r in result]
    assert counts == sorted(counts, reverse=True)


def test_aggregate_empty_returns_empty():
    assert _aggregate_by_type([]) == []


def test_aggregate_full_permutations_total():
    """All known permutations sum to 433."""
    rows = [
        _sub_row("Buckets", 2), _sub_row("Bucket", 29), _sub_row("CCP Screen", 33),
        _sub_row("Other", 1), _sub_row("Pump", 14),
        _sub_row(None, 47), _sub_row(None, 32),
        _sub_row("Connected Scale", 45), _sub_row("Manual Scale", 36),
        _sub_row("Fixed", 37), _sub_row("Mobile", 61), _sub_row("Mobile-FixBin", 81), _sub_row("ZIBC", 15),
    ]
    result = _aggregate_by_type(rows)
    assert sum(r["instrument_count"] for r in result) == 433


# ---------------------------------------------------------------------------
# _classify_state
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("status_to,expected", [
    ("IN USE",         "in_use"),
    ("in use",         "in_use"),      # case-insensitive
    ("In-Use",         "in_use"),
    ("RUNNING",        "in_use"),
    ("In Production",  "in_use"),
    ("DIRTY",          "dirty"),
    ("dirty",          "dirty"),
    ("CIP REQUIRED",   "dirty"),
    ("Awaiting Clean", "dirty"),
    ("CLEAN",          "available"),
    ("Available",      "available"),
    ("SANITISED",      "available"),
    ("Idle",           "available"),
    ("EMPTY",          "available"),
    ("UNKNOWN_STATUS", "unknown"),
    (None,             "unknown"),
    ("",               "unknown"),
])
def test_classify_state_parametrized(status_to, expected):
    assert _classify_state(status_to) == expected


# ---------------------------------------------------------------------------
# _build_state_distribution
# ---------------------------------------------------------------------------


def test_state_distribution_counts_by_bucket():
    rows = [
        _state_row("IN USE"),
        _state_row("IN USE"),
        _state_row("DIRTY"),
        _state_row("CLEAN"),
        _state_row(None),
    ]
    result = _build_state_distribution(rows)
    by_state = {r["state"]: r["count"] for r in result}
    assert by_state["in_use"] == 2
    assert by_state["dirty"] == 1
    assert by_state["available"] == 1
    assert by_state["unknown"] == 1


def test_state_distribution_pct_sums_to_100():
    rows = [_state_row("IN USE")] * 50 + [_state_row("CLEAN")] * 50
    result = _build_state_distribution(rows)
    total_pct = sum(r["pct"] for r in result)
    assert abs(total_pct - 100.0) < 0.2


def test_state_distribution_pct_zero_when_no_rows():
    result = _build_state_distribution([])
    for entry in result:
        assert entry["pct"] == 0.0
        assert entry["count"] == 0


def test_state_distribution_fixed_key_order():
    """State distribution must always return all four buckets in fixed order."""
    rows = [_state_row("IN USE")]
    result = _build_state_distribution(rows)
    assert [r["state"] for r in result] == ["in_use", "dirty", "available", "unknown"]


def test_state_distribution_pct_rounds_to_one_decimal():
    rows = [_state_row("IN USE")] * 1 + [_state_row("CLEAN")] * 2
    result = _build_state_distribution(rows)
    for entry in result:
        pct_str = str(entry["pct"])
        decimal_places = len(pct_str.split(".")[-1]) if "." in pct_str else 0
        assert decimal_places <= 1


# ---------------------------------------------------------------------------
# _build_activity_daily
# ---------------------------------------------------------------------------


def test_activity_daily_length_is_30():
    result = _build_activity_daily([], _FIXED_NOW_MS)
    assert len(result) == 30


def test_activity_daily_missing_days_filled_with_zero():
    result = _build_activity_daily([], _FIXED_NOW_MS)
    assert all(r["active_instruments"] == 0 for r in result)


def test_activity_daily_known_day_filled():
    # Build a row that matches the first bucket of the 30-day window.
    from zoneinfo import ZoneInfo
    tz = ZoneInfo("UTC")
    now_utc = datetime.fromtimestamp(_FIXED_NOW_MS / 1000, tz=dt_timezone.utc)
    local_today = now_utc.astimezone(tz).replace(hour=0, minute=0, second=0, microsecond=0)
    from datetime import timedelta
    day_29_ago_ms = int((local_today - timedelta(days=29)).timestamp() * 1000)
    rows = [{"day_ms": day_29_ago_ms, "active_instruments": 17}]
    result = _build_activity_daily(rows, _FIXED_NOW_MS)
    assert result[0]["active_instruments"] == 17


def test_activity_daily_buckets_are_ascending():
    result = _build_activity_daily([], _FIXED_NOW_MS)
    dates = [r["date"] for r in result]
    assert dates == sorted(dates)


def test_activity_daily_string_count_coerced():
    """Databricks may return active_instruments as a string."""
    from zoneinfo import ZoneInfo
    from datetime import timedelta
    tz = ZoneInfo("UTC")
    now_utc = datetime.fromtimestamp(_FIXED_NOW_MS / 1000, tz=dt_timezone.utc)
    local_today = now_utc.astimezone(tz).replace(hour=0, minute=0, second=0, microsecond=0)
    day_ms = int((local_today - timedelta(days=0)).timestamp() * 1000)
    rows = [{"day_ms": day_ms, "active_instruments": "9"}]
    result = _build_activity_daily(rows, _FIXED_NOW_MS)
    assert result[-1]["active_instruments"] == 9


# ---------------------------------------------------------------------------
# _build_activity_hourly
# ---------------------------------------------------------------------------


def test_activity_hourly_length_is_24():
    result = _build_activity_hourly([], _FIXED_NOW_MS)
    assert len(result) == 24


def test_activity_hourly_missing_hours_filled_with_zero():
    result = _build_activity_hourly([], _FIXED_NOW_MS)
    assert all(r["active_instruments"] == 0 for r in result)


def test_activity_hourly_known_hour_filled():
    from zoneinfo import ZoneInfo
    from datetime import timedelta
    tz = ZoneInfo("UTC")
    now_utc = datetime.fromtimestamp(_FIXED_NOW_MS / 1000, tz=dt_timezone.utc)
    local_now_hour = now_utc.astimezone(tz).replace(minute=0, second=0, microsecond=0)
    first_hour_ms = int((local_now_hour - timedelta(hours=24)).timestamp() * 1000)
    rows = [{"hour_ms": first_hour_ms, "active_instruments": 5}]
    result = _build_activity_hourly(rows, _FIXED_NOW_MS)
    assert result[0]["active_instruments"] == 5


def test_activity_hourly_buckets_are_ascending():
    result = _build_activity_hourly([], _FIXED_NOW_MS)
    hours = [r["hour"] for r in result]
    assert hours == sorted(hours)


def test_activity_hourly_string_count_coerced():
    """Databricks may return active_instruments as a string."""
    from zoneinfo import ZoneInfo
    from datetime import timedelta
    tz = ZoneInfo("UTC")
    now_utc = datetime.fromtimestamp(_FIXED_NOW_MS / 1000, tz=dt_timezone.utc)
    local_now_hour = now_utc.astimezone(tz).replace(minute=0, second=0, microsecond=0)
    # Last bucket is local_now_hour - 1h (i=23 → now_hour - (24-23) = now_hour - 1h).
    last_bucket_ms = int((local_now_hour - timedelta(hours=1)).timestamp() * 1000)
    rows = [{"hour_ms": last_bucket_ms, "active_instruments": "3"}]
    result = _build_activity_hourly(rows, _FIXED_NOW_MS)
    assert result[-1]["active_instruments"] == 3


# ---------------------------------------------------------------------------
# fetch_equipment_insights — integration smoke test with mocked SQL
# ---------------------------------------------------------------------------


def _make_sql_mock(results_list):
    """Return an AsyncMock that consumes successive result sets from results_list."""
    call_count = 0

    async def mock_run_sql(token, statement, params=None, *, endpoint_hint="unknown"):
        nonlocal call_count
        result = results_list[call_count % len(results_list)]
        call_count += 1
        return result

    return mock_run_sql


@pytest.mark.asyncio
async def test_fetch_equipment_insights_returns_all_keys():
    sub_type_rows = [_sub_row("Fixed", 10), _sub_row("Connected Scale", 5)]
    daily_rows = []
    hourly_rows = []
    state_rows = [_state_row("IN USE"), _state_row("CLEAN")]

    mock = _make_sql_mock([sub_type_rows, daily_rows, hourly_rows, state_rows])
    with patch("backend.dal.equipment_insights_dal.run_sql_async", mock):
        result = await fetch_equipment_insights("token")

    assert "total_instrument_count" in result
    assert "type_distribution" in result
    assert "state_distribution" in result
    assert "activity_daily30d" in result
    assert "activity_hourly24h" in result


@pytest.mark.asyncio
async def test_fetch_equipment_insights_daily_length_30():
    mock = _make_sql_mock([[], [], [], []])
    with patch("backend.dal.equipment_insights_dal.run_sql_async", mock):
        result = await fetch_equipment_insights("token")
    assert len(result["activity_daily30d"]) == 30


@pytest.mark.asyncio
async def test_fetch_equipment_insights_hourly_length_24():
    mock = _make_sql_mock([[], [], [], []])
    with patch("backend.dal.equipment_insights_dal.run_sql_async", mock):
        result = await fetch_equipment_insights("token")
    assert len(result["activity_hourly24h"]) == 24


@pytest.mark.asyncio
async def test_fetch_equipment_insights_state_distribution_four_buckets():
    state_rows = [_state_row("IN USE"), _state_row("DIRTY")]
    mock = _make_sql_mock([[], [], [], state_rows])
    with patch("backend.dal.equipment_insights_dal.run_sql_async", mock):
        result = await fetch_equipment_insights("token")
    states = {r["state"] for r in result["state_distribution"]}
    assert states == {"in_use", "dirty", "available", "unknown"}


@pytest.mark.asyncio
async def test_fetch_equipment_insights_total_count_from_sub_types():
    sub_type_rows = [_sub_row("Fixed", 20), _sub_row("Connected Scale", 10)]
    mock = _make_sql_mock([sub_type_rows, [], [], []])
    with patch("backend.dal.equipment_insights_dal.run_sql_async", mock):
        result = await fetch_equipment_insights("token")
    assert result["total_instrument_count"] == 30
