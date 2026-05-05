"""Unit tests for oee_analytics_dal — coerce helpers, series builders, fetch."""
import asyncio
from datetime import datetime, timedelta, timezone as dt_timezone

from processorderhistory_backend.manufacturing_analytics.dal import oee_analytics_dal as dal


# ---------------------------------------------------------------------------
# Fixtures / shared constants
# ---------------------------------------------------------------------------

_NOW_MS = 1_700_000_000_000
_MS_PER_DAY = 86_400_000


# ---------------------------------------------------------------------------
# _coerce_oee_row
# ---------------------------------------------------------------------------

def test_coerce_oee_row_happy_path():
    row = {
        "line_id": "L1",
        "avg_oee_pct": "85.5",
        "avg_availability_pct": "90.0",
        "avg_performance_pct": "95.0",
        "avg_quality_pct": "99.9",
        "total_scheduled_m": "1440",
        "total_downtime_m": "144",
        "total_units": "1000",
        "good_units": "999",
    }
    result = dal._coerce_oee_row(row)
    assert result["avg_oee_pct"] == 85.5
    assert result["avg_availability_pct"] == 90.0
    assert result["total_scheduled_m"] == 1440.0
    assert result["good_units"] == 999.0


def test_coerce_oee_row_nulls():
    row = {
        "line_id": "L1",
        "avg_oee_pct": None,
        "total_scheduled_m": None,
    }
    result = dal._coerce_oee_row(row)
    assert result["avg_oee_pct"] == 0.0
    assert result["total_scheduled_m"] == 0.0


# ---------------------------------------------------------------------------
# _build_daily_series
# ---------------------------------------------------------------------------

def test_build_daily_series_zero_padding():
    """Empty input produces 30 zero-filled buckets."""
    series = dal._build_daily_series([], _NOW_MS)
    assert len(series) == 30
    assert all(d["oee"] == 0.0 for d in series)
    assert all(d["availability"] == 0.0 for d in series)


def test_build_daily_series_sparse_row_fills_correctly():
    """A single non-zero row lands in the correct bucket."""
    # Note: _build_daily_series uses local_today based on _NOW_MS
    # We need to make sure our target_day_ms aligns with what the helper expects
    tz = dt_timezone.utc
    now_utc = datetime.fromtimestamp(_NOW_MS / 1000, tz=tz)
    local_today = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)
    target_day_ms = int((local_today - timedelta(days=5)).timestamp() * 1000)
    
    rows = [{"day_ms": target_day_ms, "oee_pct": "82.5", "availability_pct": "88.0"}]
    series = dal._build_daily_series(rows, _NOW_MS)
    hit = next(d for d in series if d["date"] == target_day_ms)
    assert hit["oee"] == 82.5
    assert hit["availability"] == 88.0


def test_build_daily_series_matches_utc_date_rows_to_local_buckets():
    """UTC-midnight metric dates still land in local-day buckets for non-UTC zones."""
    now_ms = int(datetime(2024, 7, 10, 12, tzinfo=dt_timezone.utc).timestamp() * 1000)
    raw_day_ms = int(datetime(2024, 7, 8, tzinfo=dt_timezone.utc).timestamp() * 1000)
    expected_bucket_ms = int(datetime(2024, 7, 7, 23, tzinfo=dt_timezone.utc).timestamp() * 1000)

    rows = [{"day_ms": raw_day_ms, "oee_pct": "82.5", "availability_pct": "88.0"}]
    series = dal._build_daily_series(rows, now_ms, "Europe/Dublin")

    hit = next(d for d in series if d["date"] == expected_bucket_ms)
    assert hit["oee"] == 82.5
    assert hit["availability"] == 88.0


# ---------------------------------------------------------------------------
# fetch_oee_analytics (orchestrator)
# ---------------------------------------------------------------------------

def test_fetch_oee_analytics_passes_to_queries(monkeypatch):
    """Ensure the parameters propagate to the underlying queries."""
    calls = []

    async def recording_mock(token, query, params=None, **kwargs):
        calls.append((query, params))
        return []

    monkeypatch.setattr(dal, "run_sql_async", recording_mock)
    result = asyncio.run(
        dal.fetch_oee_analytics("token", date_from="2024-01-01", date_to="2024-01-07", plant_id="P001")
    )
    
    assert result["lines"] == []
    assert len(calls) == 2
    
    # Range query (first)
    r_query, r_params = calls[0]
    assert "PRODUCTION_LINE" in r_query
    assert any(p["name"] == "date_from" and p["value"] == "2024-01-01" for p in r_params)
    assert any(p["name"] == "plant_id" and p["value"] == "P001" for p in r_params)
    
    # Daily query (second)
    d_query, d_params = calls[1]
    assert "INTERVAL 30 DAYS" in d_query
    assert any(p["name"] == "plant_id" and p["value"] == "P001" for p in d_params)
