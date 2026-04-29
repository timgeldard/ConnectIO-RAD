"""Unit tests for downtime_analytics_dal — coerce helpers, series builders, fetch."""
import asyncio

from backend.dal import downtime_analytics_dal as dal


# ---------------------------------------------------------------------------
# Fixtures / shared constants
# ---------------------------------------------------------------------------

_NOW_MS = 1_700_000_000_000
_MS_PER_DAY = 86_400_000


def _make_sql_mock(results_list: list[list[dict]]):
    """Return an async function that yields successive entries from results_list on each call."""
    call_iter = iter(results_list)

    async def fake_run_sql_async(_token, _query, _params=None, **_kwargs):
        return next(call_iter)

    return fake_run_sql_async


# ---------------------------------------------------------------------------
# _coerce_reason_row
# ---------------------------------------------------------------------------

def test_coerce_reason_row_happy_path():
    row = {
        "reason_code": "RC01",
        "issue_title": "Machine Jam",
        "duration_s": "3600.5",
        "event_count": "15",
    }
    result = dal._coerce_reason_row(row)
    assert result["duration_s"] == 3600.5
    assert result["event_count"] == 15


def test_coerce_reason_row_nulls():
    row = {
        "reason_code": "RC01",
        "issue_title": "Machine Jam",
        "duration_s": None,
        "event_count": None,
    }
    result = dal._coerce_reason_row(row)
    assert result["duration_s"] == 0.0
    assert result["event_count"] == 0


# ---------------------------------------------------------------------------
# _build_daily_series
# ---------------------------------------------------------------------------

def test_build_daily_series_zero_padding():
    """Empty input produces 30 zero-filled buckets."""
    series = dal._build_daily_series([], _NOW_MS)
    assert len(series) == 30
    assert all(d["duration_s"] == 0.0 for d in series)
    assert all(d["event_count"] == 0 for d in series)


def test_build_daily_series_sparse_row_fills_correctly():
    """A single non-zero row lands in the correct bucket."""
    now_day_ms = (_NOW_MS // _MS_PER_DAY) * _MS_PER_DAY
    target_day_ms = now_day_ms - 5 * _MS_PER_DAY
    rows = [{"day_ms": target_day_ms, "duration_s": "1200", "event_count": "5"}]
    series = dal._build_daily_series(rows, _NOW_MS)
    hit = next(d for d in series if d["date"] == target_day_ms)
    assert hit["duration_s"] == 1200.0
    assert hit["event_count"] == 5


def test_build_daily_series_ignores_bad_rows():
    """Rows with unparseable fields are skipped without failing the build."""
    rows = [
        {"day_ms": "not a number", "duration_s": "100", "event_count": "1"},
    ]
    series = dal._build_daily_series(rows, _NOW_MS)
    assert len(series) == 30
    assert all(d["duration_s"] == 0.0 for d in series)


# ---------------------------------------------------------------------------
# fetch_downtime_analytics (orchestrator)
# ---------------------------------------------------------------------------

def test_fetch_downtime_analytics_passes_dates_to_queries(monkeypatch):
    """Ensure the date range propagates to the underlying queries."""
    calls = []

    async def recording_mock(token, query, params=None, **kwargs):
        calls.append((query, params))
        return []

    monkeypatch.setattr(dal, "run_sql_async", recording_mock)
    result = asyncio.run(
        dal.fetch_downtime_analytics("token", date_from="2024-01-01", date_to="2024-01-07", plant_id="P001")
    )
    
    assert result["reasons"] == []
    assert len(calls) == 2
    
    # Reasons query (first)
    r_query, r_params = calls[0]
    assert "dt.START_TIME" in r_query
    assert any(p["name"] == "date_from" and p["value"] == "2024-01-01" for p in r_params)
    
    # Daily query (second)
    d_query, d_params = calls[1]
    assert "INTERVAL 30 DAYS" in d_query


def test_fetch_downtime_analytics_no_dates_falls_back_to_24h(monkeypatch):
    calls = []

    async def recording_mock(token, query, params=None, **kwargs):
        calls.append((query, params))
        return []

    monkeypatch.setattr(dal, "run_sql_async", recording_mock)
    result = asyncio.run(dal.fetch_downtime_analytics("token"))
    
    assert result["reasons"] == []
    assert len(calls) == 2
    
    r_query, r_params = calls[0]
    assert "INTERVAL 24 HOURS" in r_query
