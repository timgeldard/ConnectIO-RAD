"""Unit tests for adherence_analytics_dal — coerce helpers, series builders, fetch."""
import asyncio
from datetime import datetime, timezone as dt_timezone

from backend.dal import adherence_analytics_dal as dal


# ---------------------------------------------------------------------------
# Fixtures / shared constants
# ---------------------------------------------------------------------------

_NOW_MS = 1_700_000_000_000
_MS_PER_DAY = 86_400_000


# ---------------------------------------------------------------------------
# _coerce_adherence_row
# ---------------------------------------------------------------------------

def test_coerce_adherence_row_happy_path():
    row = {
        "order_id": "ORD1",
        "planned_qty": "100.0",
        "confirmed_qty": "100.0",
        "is_on_time": "True",
        "is_in_full": "true",
        "is_otif": "TRUE",
        "delay_days": "0",
        "qty_variance_pct": "0.0",
        "end_ms": "1700000000000",
    }
    result = dal._coerce_adherence_row(row)
    assert result["planned_qty"] == 100.0
    assert result["is_on_time"] is True
    assert result["is_in_full"] is True
    assert result["is_otif"] is True
    assert result["delay_days"] == 0
    assert result["end_ms"] == 1700000000000


def test_coerce_adherence_row_nulls():
    row = {
        "order_id": "ORD1",
        "planned_qty": None,
        "is_on_time": None,
    }
    result = dal._coerce_adherence_row(row)
    assert result["planned_qty"] == 0.0
    assert result["is_on_time"] is False


# ---------------------------------------------------------------------------
# _build_daily_series
# ---------------------------------------------------------------------------

def test_build_daily_series_zero_padding():
    """Empty input produces 30 zero-filled buckets."""
    series = dal._build_daily_series([], _NOW_MS)
    assert len(series) == 30
    assert all(d["otif_pct"] == 0.0 for d in series)
    assert all(d["order_count"] == 0 for d in series)


def test_build_daily_series_sparse_row_fills_correctly():
    """A single non-zero row lands in the correct bucket."""
    tz = dt_timezone.utc
    now_utc = datetime.fromtimestamp(_NOW_MS / 1000, tz=tz)
    local_today = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)
    target_day_ms = int((local_today - dal.timedelta(days=10)).timestamp() * 1000)
    
    rows = [{"day_ms": target_day_ms, "otif_pct": "95.0", "order_count": "20"}]
    series = dal._build_daily_series(rows, _NOW_MS)
    hit = next(d for d in series if d["date"] == target_day_ms)
    assert hit["otif_pct"] == 95.0
    assert hit["order_count"] == 20


# ---------------------------------------------------------------------------
# fetch_adherence_analytics (orchestrator)
# ---------------------------------------------------------------------------

def test_fetch_adherence_analytics_passes_to_queries(monkeypatch):
    """Ensure the parameters propagate to the underlying queries."""
    calls = []

    async def recording_mock(token, query, params=None, **kwargs):
        calls.append((query, params))
        return []

    monkeypatch.setattr(dal, "run_sql_async", recording_mock)
    result = asyncio.run(
        dal.fetch_adherence_analytics("token", date_from="2024-01-01", date_to="2024-01-07", plant_id="P001")
    )
    
    assert result["orders"] == []
    assert len(calls) == 2
    
    # Range query (first)
    r_query, r_params = calls[0]
    assert "metric_schedule_adherence" in r_query
    assert any(p["name"] == "date_from" and p["value"] == "2024-01-01" for p in r_params)
    
    # Daily query (second)
    d_query, d_params = calls[1]
    assert "INTERVAL 30 DAYS" in d_query
    assert any(p["name"] == "plant_id" and p["value"] == "P001" for p in d_params)
