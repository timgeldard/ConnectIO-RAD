"""Domain helpers for manufacturing analytics time-series buckets."""

from __future__ import annotations

from shared_manufacturing.analytics.series import (
    local_day_buckets as _local_day_buckets,
)
from shared_manufacturing.analytics.series import (
    local_hour_buckets as _local_hour_buckets,
)
from shared_manufacturing.analytics.series import (
    remap_utc_midnight_to_local_day as _remap_utc_midnight_to_local_day,
)


def local_day_buckets(now_ms: int, tz_name: str = "UTC", *, days: int = 30) -> list[int]:
    """Return UTC millis for local-day bucket starts, oldest first."""
    return _local_day_buckets(now_ms, tz_name, days=days)


def local_hour_buckets(now_ms: int, tz_name: str = "UTC", *, hours: int = 24) -> list[int]:
    """Return UTC millis for local-hour bucket starts, oldest first."""
    return _local_hour_buckets(now_ms, tz_name, hours=hours)


def remap_utc_midnight_to_local_day(day_ms: int, tz_name: str = "UTC") -> int:
    """Map a UTC-midnight metric date key onto the caller's local-day bucket."""
    return _remap_utc_midnight_to_local_day(day_ms, tz_name)
