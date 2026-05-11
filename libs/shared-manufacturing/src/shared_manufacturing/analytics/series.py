"""Domain helpers for manufacturing analytics time-series buckets."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone as dt_timezone
from zoneinfo import ZoneInfo


def local_day_buckets(now_ms: int, tz_name: str = "UTC", *, days: int = 30) -> list[int]:
    """Return UTC millis for local-day bucket starts, oldest first."""

    tz = ZoneInfo(tz_name)
    now_utc = datetime.fromtimestamp(now_ms / 1000, tz=dt_timezone.utc)
    local_today = now_utc.astimezone(tz).replace(hour=0, minute=0, second=0, microsecond=0)
    return [
        int((local_today - timedelta(days=days - 1 - index)).astimezone(dt_timezone.utc).timestamp() * 1000)
        for index in range(days)
    ]


def local_hour_buckets(now_ms: int, tz_name: str = "UTC", *, hours: int = 24) -> list[int]:
    """Return UTC millis for local-hour bucket starts, oldest first."""

    tz = ZoneInfo(tz_name)
    now_utc = datetime.fromtimestamp(now_ms / 1000, tz=dt_timezone.utc)
    local_now_hour = now_utc.astimezone(tz).replace(minute=0, second=0, microsecond=0)
    return [
        int((local_now_hour - timedelta(hours=hours - index)).astimezone(dt_timezone.utc).timestamp() * 1000)
        for index in range(hours)
    ]


def remap_utc_midnight_to_local_day(day_ms: int, tz_name: str = "UTC") -> int:
    """Map a UTC-midnight metric date key onto the caller's local-day bucket."""

    tz = ZoneInfo(tz_name)
    return int(
        datetime.fromtimestamp(day_ms / 1000, tz=dt_timezone.utc)
        .astimezone(tz)
        .replace(hour=0, minute=0, second=0, microsecond=0)
        .astimezone(dt_timezone.utc)
        .timestamp()
        * 1000
    )
