"""Domain tests for manufacturing analytics series bucket rules."""

from datetime import datetime, timezone as dt_timezone

from processorderhistory_backend.manufacturing_analytics.domain.series import (
    local_day_buckets,
    local_hour_buckets,
    remap_utc_midnight_to_local_day,
)


def test_local_day_buckets_are_30_ascending_days():
    now_ms = int(datetime(2026, 4, 30, 12, tzinfo=dt_timezone.utc).timestamp() * 1000)

    buckets = local_day_buckets(now_ms)

    assert len(buckets) == 30
    assert buckets == sorted(buckets)


def test_local_hour_buckets_are_24_ascending_hours():
    now_ms = int(datetime(2026, 4, 30, 12, tzinfo=dt_timezone.utc).timestamp() * 1000)

    buckets = local_hour_buckets(now_ms)

    assert len(buckets) == 24
    assert buckets == sorted(buckets)


def test_remap_utc_midnight_to_local_day_handles_timezone_shift():
    utc_midnight_ms = int(datetime(2026, 4, 30, tzinfo=dt_timezone.utc).timestamp() * 1000)

    remapped = remap_utc_midnight_to_local_day(utc_midnight_ms, "Europe/Dublin")

    assert remapped == utc_midnight_ms - 3_600_000
