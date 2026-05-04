"""Unit tests for yield_analytics_dal — coerce helpers, series builders, fetch."""
import asyncio

import pytest

from backend.manufacturing_analytics.dal import yield_analytics_dal as dal

# ---------------------------------------------------------------------------
# _coerce_order
# ---------------------------------------------------------------------------

def test_coerce_order_happy_path():
    """All fields populated as strings; expects correct type coercion."""
    row = {
        "qty_received_kg": "980.5",
        "qty_issued_kg": "1000.0",
        "yield_pct": "98.05",
        "loss_kg": "19.5",
        "order_date_ms": "1700000000000",
    }
    result = dal._coerce_order(row)
    assert result["qty_received_kg"] == 980.5
    assert result["qty_issued_kg"] == 1000.0
    assert result["yield_pct"] == 98.05
    assert result["loss_kg"] == 19.5
    assert result["order_date_ms"] == 1700000000000


def test_coerce_order_null_qty():
    """qty_received_kg and qty_issued_kg default to 0.0 when None."""
    row = {"qty_received_kg": None, "qty_issued_kg": None, "yield_pct": "97.0", "loss_kg": "30.0", "order_date_ms": "0"}
    r = dal._coerce_order(row)
    assert r["qty_received_kg"] == 0.0 and r["qty_issued_kg"] == 0.0


def test_coerce_order_null_yield_pct():
    """yield_pct remains None when None (not 0.0)."""
    row = {"qty_received_kg": "0.0", "qty_issued_kg": "0.0", "yield_pct": None, "loss_kg": None, "order_date_ms": "0"}
    assert dal._coerce_order(row)["yield_pct"] is None


def test_coerce_order_null_loss_kg():
    """loss_kg remains None when None (not 0.0)."""
    row = {"qty_received_kg": "500.0", "qty_issued_kg": "0.0", "yield_pct": None, "loss_kg": None, "order_date_ms": "0"}
    assert dal._coerce_order(row)["loss_kg"] is None


def test_coerce_order_rounds_qty_to_6dp():
    """qty_received_kg and qty_issued_kg are rounded to 6 decimal places."""
    row = {
        "qty_received_kg": "980.1234567",
        "qty_issued_kg": "1000.9876543",
        "yield_pct": None, "loss_kg": None, "order_date_ms": "0",
    }
    result = dal._coerce_order(row)
    assert result["qty_received_kg"] == round(980.1234567, 6)
    assert result["qty_issued_kg"] == round(1000.9876543, 6)


# ---------------------------------------------------------------------------
# _build_daily_series
# ---------------------------------------------------------------------------

_NOW_MS = 1_700_000_000_000
_MS_PER_DAY = 86_400_000


def test_build_daily_series_zero_padding():
    """Empty rows produce exactly 30 buckets, all with avg_yield_pct=None."""
    series = dal._build_daily_series([], _NOW_MS)
    assert len(series) == 30
    assert all(d["avg_yield_pct"] is None for d in series)


def test_build_daily_series_sparse_row_fills_correctly():
    """A single row populates its bucket; surrounding buckets remain None."""
    now_day = (_NOW_MS // _MS_PER_DAY) * _MS_PER_DAY
    day_ms = now_day - 5 * _MS_PER_DAY
    rows = [{"day_ms": day_ms, "avg_yield_pct": "96.5"}]
    series = dal._build_daily_series(rows, _NOW_MS)
    assert len(series) == 30
    hit = next(d for d in series if d["date"] == day_ms)
    assert hit["avg_yield_pct"] == 96.5
    miss = next(d for d in series if d["date"] == day_ms - _MS_PER_DAY)
    assert miss["avg_yield_pct"] is None


def test_build_daily_series_null_avg_yield_pct_preserved():
    """SQL NULL avg_yield_pct in a row produces None in the series (not 0.0)."""
    now_day = (_NOW_MS // _MS_PER_DAY) * _MS_PER_DAY
    day_ms = now_day - 3 * _MS_PER_DAY
    rows = [{"day_ms": day_ms, "avg_yield_pct": None}]
    series = dal._build_daily_series(rows, _NOW_MS)
    hit = next(d for d in series if d["date"] == day_ms)
    assert hit["avg_yield_pct"] is None


# ---------------------------------------------------------------------------
# _build_hourly_series
# ---------------------------------------------------------------------------

_MS_PER_HOUR = 3_600_000


def test_build_hourly_series_zero_padding():
    """Empty rows produce exactly 24 buckets, all with avg_yield_pct=None."""
    series = dal._build_hourly_series([], _NOW_MS)
    assert len(series) == 24
    assert all(h["avg_yield_pct"] is None for h in series)


def test_build_hourly_series_sparse_row_fills_correctly():
    """A single row populates its bucket; surrounding buckets remain None."""
    now_hour = (_NOW_MS // _MS_PER_HOUR) * _MS_PER_HOUR
    hour_ms = now_hour - 10 * _MS_PER_HOUR
    rows = [{"hour_ms": hour_ms, "avg_yield_pct": "94.2"}]
    series = dal._build_hourly_series(rows, _NOW_MS)
    assert len(series) == 24
    hit = next(h for h in series if h["hour"] == hour_ms)
    assert hit["avg_yield_pct"] == 94.2


# ---------------------------------------------------------------------------
# fetch_yield_analytics — integration (mocked run_sql_async)
# ---------------------------------------------------------------------------

def _make_sql_mock(call_results: list[list[dict]]):
    """Return a fake ``run_sql_async`` that replays ``call_results`` in order."""
    call_iter = iter(call_results)

    async def fake_run_sql_async(_token, _query, _params=None, **_kwargs):
        return next(call_iter)

    return fake_run_sql_async


def test_fetch_yield_analytics_returns_correct_shape(monkeypatch):
    """All expected keys are present and series have correct lengths."""
    monkeypatch.setattr(dal, "run_sql_async", _make_sql_mock([[], [], [], []]))
    result = asyncio.run(dal.fetch_yield_analytics("token", date_from="2024-01-01", date_to="2024-01-07"))
    assert "now_ms" in result
    assert result["target_yield_pct"] == 95.0
    assert "materials" in result
    assert "orders" in result
    assert "prior7d" in result
    assert len(result["daily30d"]) == 30
    assert len(result["hourly24h"]) == 24


def test_fetch_yield_analytics_prior7d_empty_when_no_date_from(monkeypatch):
    """Q4 short-circuits to [] when date_from is None — only 3 SQL calls fired."""
    calls: list = []

    async def recording_mock(_token, _query, _params=None, **_kwargs):
        calls.append(_params)
        return []

    monkeypatch.setattr(dal, "run_sql_async", recording_mock)
    result = asyncio.run(dal.fetch_yield_analytics("token"))
    assert result["prior7d"] == []
    assert len(calls) == 3  # orders_range, daily30d, hourly24h only
