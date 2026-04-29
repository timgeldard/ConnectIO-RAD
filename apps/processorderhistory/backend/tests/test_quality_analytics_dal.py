"""Unit tests for quality_analytics_dal — coerce helpers, series builders, fetch."""
import asyncio

from backend.dal import quality_analytics_dal as dal


# ---------------------------------------------------------------------------
# Fixtures / shared constants
# ---------------------------------------------------------------------------

_NOW_MS = 1_700_000_000_000
_MS_PER_DAY = 86_400_000
_MS_PER_HOUR = 3_600_000


def _make_sql_mock(results_list: list[list[dict]]):
    """Return an async function that yields successive entries from results_list on each call.

    Mirrors the pattern used in test_pours_analytics_dal.py.  Accepts and
    ignores keyword arguments so it is compatible with the endpoint_hint kwarg
    passed by run_sql_async callers.
    """
    call_iter = iter(results_list)

    async def fake_run_sql_async(_token, _query, _params=None, **_kwargs):
        return next(call_iter)

    return fake_run_sql_async


# ---------------------------------------------------------------------------
# _coerce_row
# ---------------------------------------------------------------------------

def test_coerce_row_happy_path():
    """All fields present and string-serialised — coerced to correct Python types."""
    row = {
        "quantitative_result": "7.42",
        "result_date_ms": "1700000000000",
        "quality_score": "95.5",
    }
    result = dal._coerce_row(row)
    assert result["quantitative_result"] == 7.42
    assert result["result_date_ms"] == 1700000000000
    assert result["quality_score"] == 95.5


def test_coerce_row_null_quantitative_result():
    """quantitative_result of None should remain None (not 0.0 or raise)."""
    row = {
        "quantitative_result": None,
        "result_date_ms": "1700000000000",
        "quality_score": "95.5",
    }
    result = dal._coerce_row(row)
    assert result["quantitative_result"] is None


def test_coerce_row_null_quality_score():
    """quality_score of None should remain None."""
    row = {
        "quantitative_result": "7.42",
        "result_date_ms": "1700000000000",
        "quality_score": None,
    }
    result = dal._coerce_row(row)
    assert result["quality_score"] is None


def test_coerce_row_null_result_date_ms():
    """result_date_ms of None should default to 0 (sentinel for missing timestamp)."""
    row = {
        "quantitative_result": "7.42",
        "result_date_ms": None,
        "quality_score": "95.5",
    }
    result = dal._coerce_row(row)
    assert result["result_date_ms"] == 0


# ---------------------------------------------------------------------------
# _build_daily_series
# ---------------------------------------------------------------------------

def test_build_daily_series_zero_padding():
    """Empty input produces 30 zero-filled buckets."""
    series = dal._build_daily_series([], _NOW_MS)
    assert len(series) == 30
    assert all(d["accepted"] == 0 for d in series)
    assert all(d["rejected"] == 0 for d in series)


def test_build_daily_series_sparse_row_fills_correctly():
    """A single non-zero row lands in the correct bucket; surrounding buckets stay zero."""
    now_day_ms = (_NOW_MS // _MS_PER_DAY) * _MS_PER_DAY
    target_day_ms = now_day_ms - 5 * _MS_PER_DAY
    rows = [{"day_ms": target_day_ms, "accepted_count": "6", "rejected_count": "2"}]
    series = dal._build_daily_series(rows, _NOW_MS)
    hit = next(d for d in series if d["date"] == target_day_ms)
    assert hit["accepted"] == 6
    assert hit["rejected"] == 2
    zero = next(d for d in series if d["date"] == target_day_ms - _MS_PER_DAY)
    assert zero["accepted"] == 0
    assert zero["rejected"] == 0


def test_build_daily_series_computes_rft_pct():
    """rft_pct = accepted / (accepted + rejected) * 100, rounded to 1 dp."""
    now_day_ms = (_NOW_MS // _MS_PER_DAY) * _MS_PER_DAY
    target_day_ms = now_day_ms - 3 * _MS_PER_DAY
    # 8 accepted, 2 rejected → 80.0 %
    rows = [{"day_ms": target_day_ms, "accepted_count": "8", "rejected_count": "2"}]
    series = dal._build_daily_series(rows, _NOW_MS)
    hit = next(d for d in series if d["date"] == target_day_ms)
    assert hit["rft_pct"] == 80.0


def test_build_daily_series_null_rft_for_zero_bucket():
    """A bucket with no inspections should have rft_pct = None, not 0."""
    series = dal._build_daily_series([], _NOW_MS)
    assert all(d["rft_pct"] is None for d in series)


# ---------------------------------------------------------------------------
# _build_hourly_series
# ---------------------------------------------------------------------------

def test_build_hourly_series_zero_padding():
    """Empty input produces 24 zero-filled buckets."""
    series = dal._build_hourly_series([], _NOW_MS)
    assert len(series) == 24
    assert all(h["accepted"] == 0 for h in series)
    assert all(h["rejected"] == 0 for h in series)


def test_build_hourly_series_sparse_row_fills_correctly():
    """A single non-zero row lands in the correct bucket; surrounding buckets stay zero."""
    now_hour_ms = (_NOW_MS // _MS_PER_HOUR) * _MS_PER_HOUR
    target_hour_ms = now_hour_ms - 10 * _MS_PER_HOUR
    rows = [{"hour_ms": target_hour_ms, "accepted_count": "3", "rejected_count": "1"}]
    series = dal._build_hourly_series(rows, _NOW_MS)
    hit = next(h for h in series if h["hour"] == target_hour_ms)
    assert hit["accepted"] == 3
    assert hit["rejected"] == 1
    zero = next(h for h in series if h["hour"] == target_hour_ms - _MS_PER_HOUR)
    assert zero["accepted"] == 0
    assert zero["rejected"] == 0


# ---------------------------------------------------------------------------
# fetch_quality_analytics — integration (mocked run_sql_async)
# ---------------------------------------------------------------------------

_RESULT_ROW = {
    "process_order": "PO001",
    "inspection_lot_id": "IL001",
    "material_id": "MAT001",
    "material_name": "Whey Protein",
    "plant_id": "IE01",
    "characteristic_id": "CHAR01",
    "characteristic_description": "Protein %",
    "sample_id": "S001",
    "specification": ">=80",
    "quantitative_result": "82.5",
    "qualitative_result": None,
    "uom": "%",
    "judgement": "A",
    "result_date_ms": "1699913600000",
    "usage_decision_code": "A01",
    "valuation_code": "UD01",
    "quality_score": "95.0",
}

_DAILY_ROW = {
    "day_ms": str((_NOW_MS // _MS_PER_DAY) * _MS_PER_DAY - 2 * _MS_PER_DAY),
    "accepted_count": "5",
    "rejected_count": "1",
}

_HOURLY_ROW = {
    "hour_ms": str((_NOW_MS // _MS_PER_HOUR) * _MS_PER_HOUR - 5 * _MS_PER_HOUR),
    "accepted_count": "2",
    "rejected_count": "0",
}


def test_fetch_quality_analytics_returns_correct_shape(monkeypatch):
    """All expected keys present; series lengths correct; prior7d empty when no date_from."""
    # No date_from → prior7d returns [] early without firing a SQL call → 3 DB calls total
    monkeypatch.setattr(dal, "run_sql_async", _make_sql_mock([
        [_RESULT_ROW],  # results_range
        [_DAILY_ROW],   # daily30d
        [_HOURLY_ROW],  # hourly24h
    ]))
    result = asyncio.run(dal.fetch_quality_analytics("token"))

    assert "now_ms" in result
    assert "materials" in result
    assert "rows" in result
    assert "prior7d" in result
    assert "daily30d" in result
    assert "hourly24h" in result

    assert len(result["daily30d"]) == 30
    assert len(result["hourly24h"]) == 24

    assert len(result["rows"]) == 1
    assert result["rows"][0]["quantitative_result"] == 82.5
    assert result["rows"][0]["quality_score"] == 95.0

    assert result["prior7d"] == []
    assert result["materials"] == ["Whey Protein"]


def test_fetch_quality_analytics_prior7d_empty_when_no_date_from(monkeypatch):
    """When date_from is None, only 3 SQL calls are made (prior7d short-circuits to [])."""
    calls: list = []

    async def counting_mock(_token, _query, _params=None, **_kwargs):
        calls.append(_params)
        # Return empty lists for all three real DB calls
        return []

    monkeypatch.setattr(dal, "run_sql_async", counting_mock)
    result = asyncio.run(dal.fetch_quality_analytics("token"))

    assert len(calls) == 3
    assert result["prior7d"] == []
