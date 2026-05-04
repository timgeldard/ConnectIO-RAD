"""Domain rules for manufacturing equipment insights."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone as dt_timezone
from typing import Optional
from zoneinfo import ZoneInfo


SUBTYPE_TO_TYPE: dict[str, str] = {
    "Bucket": "Auxiliary Equipment",
    "Buckets": "Auxiliary Equipment",
    "CCP Screen": "Auxiliary Equipment",
    "Other": "Auxiliary Equipment",
    "Pump": "Auxiliary Equipment",
    "Connected Scale": "Scale",
    "Manual Scale": "Scale",
    "Fixed": "Vessel",
    "Mobile": "Vessel",
    "Mobile-FixBin": "Vessel",
    "ZIBC": "Vessel",
}

UNCATEGORISED = "Uncategorised"

IN_USE_KEYWORDS = frozenset({
    "IN USE", "IN-USE", "INUSE", "RUNNING", "OCCUPIED", "ACTIVE", "PRODUCTION", "PROCESS",
    "IN PRODUCTION", "IN PROCESS",
})
DIRTY_KEYWORDS = frozenset({
    "DIRTY", "UNCLEAN", "CLEAN REQUIRED", "NEEDS CLEAN", "NEED CLEAN",
    "CIP REQUIRED", "SOAKING", "RINSE", "AWAITING CLEAN",
})
AVAILABLE_KEYWORDS = frozenset({
    "AVAILABLE", "CLEAN", "FREE", "READY", "IDLE", "EMPTY",
    "SANITISED", "SANITIZED", "CLEANED",
})


def aggregate_by_type(sub_type_rows: list[dict]) -> list[dict]:
    """Aggregate instrument counts from equipment subtype to equipment type."""

    totals: dict[str, int] = defaultdict(int)
    for row in sub_type_rows:
        sub_type = row.get("equipment_sub_type")
        count = int(row.get("instrument_count") or 0)
        equipment_type = SUBTYPE_TO_TYPE.get(sub_type, UNCATEGORISED) if sub_type else UNCATEGORISED
        totals[equipment_type] += count
    return [
        {"equipment_type": equipment_type, "instrument_count": count}
        for equipment_type, count in sorted(totals.items(), key=lambda item: -item[1])
    ]


def derive_equipment_insights(type_rows: list[dict]) -> dict:
    """Build estate summary metrics from type-aggregated rows."""

    total = sum(int(row.get("instrument_count") or 0) for row in type_rows)
    type_distribution = [
        {
            "equipment_type": str(row.get("equipment_type") or "Unknown"),
            "count": int(row.get("instrument_count") or 0),
            "pct": round(int(row.get("instrument_count") or 0) / total * 100, 1) if total else 0.0,
        }
        for row in type_rows
    ]
    return {
        "total_instrument_count": total,
        "type_distribution": type_distribution,
    }


def classify_state(status_to: Optional[str]) -> str:
    """Classify an equipment status into in_use, dirty, available, or unknown."""

    if not status_to:
        return "unknown"
    upper = status_to.upper().strip()
    if any(keyword in upper for keyword in IN_USE_KEYWORDS):
        return "in_use"
    if any(keyword in upper for keyword in DIRTY_KEYWORDS):
        return "dirty"
    if any(keyword in upper for keyword in AVAILABLE_KEYWORDS):
        return "available"
    return "unknown"


def build_state_distribution(state_rows: list[dict]) -> list[dict]:
    """Count instruments per state bucket in stable display order."""

    counts: dict[str, int] = {"in_use": 0, "dirty": 0, "available": 0, "unknown": 0}
    for row in state_rows:
        counts[classify_state(row.get("status_to"))] += 1
    total = sum(counts.values())
    return [
        {
            "state": state,
            "count": count,
            "pct": round(count / total * 100, 1) if total else 0.0,
        }
        for state, count in counts.items()
    ]


def build_activity_daily(rows: list[dict], now_ms: int, tz_name: str = "UTC") -> list[dict]:
    """Build a zero-padded 30-day active-instrument series aligned to local days."""

    tz = ZoneInfo(tz_name)
    now_utc = datetime.fromtimestamp(now_ms / 1000, tz=dt_timezone.utc)
    local_today = now_utc.astimezone(tz).replace(hour=0, minute=0, second=0, microsecond=0)
    day_buckets = [
        int((local_today - timedelta(days=29 - index)).astimezone(dt_timezone.utc).timestamp() * 1000)
        for index in range(30)
    ]
    sparse = {int(row["day_ms"]): int(row.get("active_instruments") or 0) for row in rows}
    return [{"date": day_ms, "active_instruments": sparse.get(day_ms, 0)} for day_ms in day_buckets]


def build_activity_hourly(rows: list[dict], now_ms: int, tz_name: str = "UTC") -> list[dict]:
    """Build a zero-padded 24-hour active-instrument series aligned to local hours."""

    tz = ZoneInfo(tz_name)
    now_utc = datetime.fromtimestamp(now_ms / 1000, tz=dt_timezone.utc)
    local_now_hour = now_utc.astimezone(tz).replace(minute=0, second=0, microsecond=0)
    hour_buckets = [
        int((local_now_hour - timedelta(hours=24 - index)).astimezone(dt_timezone.utc).timestamp() * 1000)
        for index in range(24)
    ]
    sparse = {int(row["hour_ms"]): int(row.get("active_instruments") or 0) for row in rows}
    return [{"hour": hour_ms, "active_instruments": sparse.get(hour_ms, 0)} for hour_ms in hour_buckets]
