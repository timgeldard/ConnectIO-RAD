"""Unit tests for pours_analytics_dal — coerce helpers, series builders, fetch."""
import asyncio
from unittest.mock import patch

import pytest

from backend.dal import pours_analytics_dal as dal


# ---------------------------------------------------------------------------
# _utc_shift
# ---------------------------------------------------------------------------

def test_utc_shift_night():
    assert dal._utc_shift(0) == "C"
    assert dal._utc_shift(7) == "C"


def test_utc_shift_day():
    assert dal._utc_shift(8) == "A"
    assert dal._utc_shift(15) == "A"


def test_utc_shift_evening():
    assert dal._utc_shift(16) == "B"
    assert dal._utc_shift(23) == "B"


# ---------------------------------------------------------------------------
# _coerce_event
# ---------------------------------------------------------------------------

def test_coerce_event_converts_values():
    row = {"quantity": "250.5", "ts_ms": "1700000000000", "utc_hour": "14"}
    result = dal._coerce_event(row)
    assert result["quantity"] == 250.5
    assert result["ts_ms"] == 1700000000000
    assert result["utc_hour"] == 14
    assert result["shift"] == "A"


def test_coerce_event_handles_nulls():
    row = {"quantity": None, "ts_ms": None, "utc_hour": None}
    result = dal._coerce_event(row)
    assert result["quantity"] == 0.0
    assert result["ts_ms"] == 0
    assert result["utc_hour"] == 0
    assert result["shift"] == "C"


# ---------------------------------------------------------------------------
# _build_daily_series
# ---------------------------------------------------------------------------

_NOW_MS = 1_700_000_000_000
_MS_PER_DAY = 86_400_000


def test_build_daily_series_produces_30_buckets():
    series, lines = dal._build_daily_series([], _NOW_MS)
    assert len(series["ALL"]) == 30
    assert lines == []


def test_build_daily_series_fills_zeros():
    now_day = (_NOW_MS // _MS_PER_DAY) * _MS_PER_DAY
    day_ms = now_day - 5 * _MS_PER_DAY
    rows = [{"day_ms": day_ms, "line_id": "MIX-04", "pour_count": 12}]
    series, lines = dal._build_daily_series(rows, _NOW_MS)
    assert lines == ["MIX-04"]
    mix_series = series["MIX-04"]
    assert len(mix_series) == 30
    # Find the bucket with the data
    hit = next(d for d in mix_series if d["date"] == day_ms)
    assert hit["actual"] == 12
    # Adjacent bucket should be zero
    zero = next(d for d in mix_series if d["date"] == day_ms - _MS_PER_DAY)
    assert zero["actual"] == 0


def test_build_daily_series_all_key_aggregates():
    now_day = (_NOW_MS // _MS_PER_DAY) * _MS_PER_DAY
    day_ms = now_day - 2 * _MS_PER_DAY
    rows = [
        {"day_ms": day_ms, "line_id": "MIX-04", "pour_count": 10},
        {"day_ms": day_ms, "line_id": "SPD-02", "pour_count": 5},
    ]
    series, lines = dal._build_daily_series(rows, _NOW_MS)
    assert sorted(lines) == ["MIX-04", "SPD-02"]
    all_hit = next(d for d in series["ALL"] if d["date"] == day_ms)
    assert all_hit["actual"] == 15


def test_build_daily_series_target_is_none():
    series, _ = dal._build_daily_series([], _NOW_MS)
    assert series["ALL"][0]["target"] is None


# ---------------------------------------------------------------------------
# _build_hourly_series
# ---------------------------------------------------------------------------

_MS_PER_HOUR = 3_600_000


def test_build_hourly_series_produces_24_buckets():
    series = dal._build_hourly_series([], _NOW_MS)
    assert len(series["ALL"]) == 24


def test_build_hourly_series_fills_zeros():
    now_hour = (_NOW_MS // _MS_PER_HOUR) * _MS_PER_HOUR
    hour_ms = now_hour - 10 * _MS_PER_HOUR
    rows = [{"hour_ms": hour_ms, "line_id": "MIX-04", "pour_count": 7}]
    series = dal._build_hourly_series(rows, _NOW_MS)
    assert "MIX-04" in series
    hit = next((h for h in series["MIX-04"] if h["hour"] == hour_ms), None)
    assert hit is not None
    assert hit["actual"] == 7


def test_build_hourly_series_all_key_aggregates():
    now_hour = (_NOW_MS // _MS_PER_HOUR) * _MS_PER_HOUR
    hour_ms = now_hour - 3 * _MS_PER_HOUR
    rows = [
        {"hour_ms": hour_ms, "line_id": "MIX-04", "pour_count": 4},
        {"hour_ms": hour_ms, "line_id": "SPD-02", "pour_count": 3},
    ]
    series = dal._build_hourly_series(rows, _NOW_MS)
    all_hit = next(h for h in series["ALL"] if h["hour"] == hour_ms)
    assert all_hit["actual"] == 7


# ---------------------------------------------------------------------------
# fetch_pours_analytics — integration (mocked run_sql_async)
# ---------------------------------------------------------------------------

_EVENT_ROW = {
    "material_name": "Whey Protein",
    "quantity": "250.0",
    "uom": "KG",
    "source_area": "STOR-01",
    "operator": "M.BRENNAN",
    "ts_ms": "1699913600000",
    "utc_hour": "10",
    "line_id": "MIX-04",
}

_DAILY_ROW = {
    "day_ms": str((_NOW_MS // _MS_PER_DAY) * _MS_PER_DAY - 2 * _MS_PER_DAY),
    "line_id": "MIX-04",
    "pour_count": "8",
}

_HOURLY_ROW = {
    "hour_ms": str((_NOW_MS // _MS_PER_HOUR) * _MS_PER_HOUR - 5 * _MS_PER_HOUR),
    "line_id": "MIX-04",
    "pour_count": "3",
}

_SCHEDULED_ROW = {"scheduled_count": "42"}


def _make_sql_mock(call_results: list[list[dict]]):
    call_iter = iter(call_results)

    async def fake_run_sql_async(_token, _query, _params=None, **_kwargs):
        return next(call_iter)

    return fake_run_sql_async


def test_fetch_pours_analytics_returns_full_shape(monkeypatch):
    monkeypatch.setattr(dal, "run_sql_async", _make_sql_mock([
        [_EVENT_ROW],    # events_24h
        [_DAILY_ROW],    # daily30d
        [_HOURLY_ROW],   # hourly24h
        [_SCHEDULED_ROW],  # scheduled_24h
    ]))
    result = asyncio.run(dal.fetch_pours_analytics("token"))
    assert result["planned_24h"] == 42
    assert result["lines"] == ["MIX-04"]
    assert len(result["events_24h"]) == 1
    assert result["events_24h"][0]["quantity"] == 250.0
    assert result["events_24h"][0]["shift"] == "A"
    assert "ALL" in result["daily30d"]
    assert "MIX-04" in result["daily30d"]
    assert len(result["daily30d"]["ALL"]) == 30
    assert "ALL" in result["hourly24h"]
    assert len(result["hourly24h"]["ALL"]) == 24
    assert "now_ms" in result


def test_fetch_pours_analytics_empty_data(monkeypatch):
    monkeypatch.setattr(dal, "run_sql_async", _make_sql_mock([
        [], [], [], [],
    ]))
    result = asyncio.run(dal.fetch_pours_analytics("token"))
    assert result["planned_24h"] == 0
    assert result["lines"] == []
    assert result["events_24h"] == []
    assert len(result["daily30d"]["ALL"]) == 30
    assert all(d["actual"] == 0 for d in result["daily30d"]["ALL"])
    assert len(result["hourly24h"]["ALL"]) == 24
    assert all(h["actual"] == 0 for h in result["hourly24h"]["ALL"])


def test_fetch_pours_analytics_with_plant_id(monkeypatch):
    calls = []
    original_mock = _make_sql_mock([
        [], [], [], [_SCHEDULED_ROW],
    ])

    async def recording_mock(token, query, params=None, **kwargs):
        calls.append(params)
        return await original_mock(token, query, params, **kwargs)

    monkeypatch.setattr(dal, "run_sql_async", recording_mock)
    asyncio.run(dal.fetch_pours_analytics("token", plant_id="P001"))
    # The 4th call (scheduled_24h) should have a plant_id param
    scheduled_params = calls[3]
    assert scheduled_params is not None
    assert scheduled_params[0]["name"] == "plant_id"
    assert scheduled_params[0]["value"] == "P001"
