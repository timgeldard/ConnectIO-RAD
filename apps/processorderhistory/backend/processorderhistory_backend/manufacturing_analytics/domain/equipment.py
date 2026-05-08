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

_MAX_TTC_MINUTES = 24 * 60  # sanity cap: discard anomalous cycles longer than one day

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


# =============================================================================
# Equipment Insights v2 domain functions
# =============================================================================


def group_events_by_instrument(rows: list[dict]) -> dict[str, list[dict]]:
    """Group chronological event rows (from _q_event_timeline) by instrument_id.

    Input rows must be sorted by change_at_ms ascending — the SQL query
    guarantees this via ORDER BY INSTRUMENT_ID, change_at_ms ASC.
    """
    result: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        iid = str(row.get("instrument_id") or "")
        if iid:
            result[iid].append(row)
    return dict(result)


def compute_per_instrument_metrics(events: list[dict], now_ms: int) -> dict:
    """Compute TTC, utilisation, MTBC, dirty-age, and last-clean from a single instrument's history.

    Args:
        events: Chronological list of ``{status_to, change_at_ms}`` dicts for one instrument,
            sorted by change_at_ms ascending.
        now_ms: Current UTC epoch milliseconds (used as the end of the observation window).

    Returns:
        Dict with keys:
          - ``ttc_min``         — average minutes from dirty→clean (0.0 if no cycles)
          - ``utilisation_pct`` — % of the last 7 days spent in-use (0.0–100.0)
          - ``mtbc_h``          — mean time between clean events in hours (0.0 if < 2 cleans)
          - ``dirty_age_min``   — minutes since the instrument went dirty, or None if not dirty
          - ``last_clean_ms``   — epoch ms of the last available/clean transition (0 if never)
    """
    _SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
    window_start = now_ms - _SEVEN_DAYS_MS

    ttc_samples: list[float] = []
    clean_timestamps: list[int] = []
    last_clean_ms = 0
    dirty_age_min: Optional[float] = None
    util_in_use_ms = 0

    for i, event in enumerate(events):
        start_ms = int(event["change_at_ms"])
        end_ms = int(events[i + 1]["change_at_ms"]) if i + 1 < len(events) else now_ms
        state = classify_state(event.get("status_to"))

        # TTC: dirty interval immediately followed by available transition
        if state == "dirty" and i + 1 < len(events):
            next_state = classify_state(events[i + 1].get("status_to"))
            if next_state == "available":
                duration_min = (int(events[i + 1]["change_at_ms"]) - start_ms) / 60_000
                if 0 < duration_min < _MAX_TTC_MINUTES:
                    ttc_samples.append(duration_min)

        # Track last clean event
        if state == "available":
            clean_timestamps.append(start_ms)
            if start_ms > last_clean_ms:
                last_clean_ms = start_ms

        # Utilisation: sum in-use time within last-7d window
        if state == "in_use":
            seg_start = max(start_ms, window_start)
            seg_end = min(end_ms, now_ms)
            if seg_end > seg_start:
                util_in_use_ms += seg_end - seg_start

    # Current dirty age — only if the most recent event is dirty
    if events and classify_state(events[-1].get("status_to")) == "dirty":
        dirty_age_min = (now_ms - int(events[-1]["change_at_ms"])) / 60_000

    # MTBC: average gap between successive clean entries (in hours)
    mtbc_h = 0.0
    if len(clean_timestamps) >= 2:
        gaps_h = [
            (clean_timestamps[j + 1] - clean_timestamps[j]) / 3_600_000
            for j in range(len(clean_timestamps) - 1)
        ]
        mtbc_h = sum(gaps_h) / len(gaps_h)

    util_pct = min(100.0, util_in_use_ms / _SEVEN_DAYS_MS * 100)

    return {
        "ttc_min":          round(sum(ttc_samples) / len(ttc_samples), 1) if ttc_samples else 0.0,
        "utilisation_pct":  round(util_pct, 1),
        "mtbc_h":           round(mtbc_h, 2),
        "dirty_age_min":    round(dirty_age_min, 1) if dirty_age_min is not None else None,
        "last_clean_ms":    last_clean_ms,
    }


def build_ttc_trend(
    events_by_instrument: dict[str, list[dict]],
    now_ms: int,
    tz_name: str = "UTC",
    days: int = 14,
) -> list[float]:
    """Build a ``days``-element list of daily average TTC (minutes) across all instruments.

    The returned list is ordered oldest-first; element 0 is ``days-1`` days ago,
    element ``days-1`` is today. Days with no completed dirty→clean cycles return 0.0.

    Args:
        events_by_instrument: Output of :func:`group_events_by_instrument`.
        now_ms: Current UTC epoch milliseconds.
        tz_name: IANA timezone name for day-boundary alignment.
        days: Number of daily buckets to return (default 14).

    Returns:
        List of ``days`` floats — average TTC in minutes per day.
    """
    tz = ZoneInfo(tz_name)
    now_utc = datetime.fromtimestamp(now_ms / 1000, tz=dt_timezone.utc)
    local_today = now_utc.astimezone(tz).replace(hour=0, minute=0, second=0, microsecond=0)

    daily_samples: dict[int, list[float]] = {d: [] for d in range(days)}

    for instrument_events in events_by_instrument.values():
        for i, event in enumerate(instrument_events):
            if classify_state(event.get("status_to")) != "dirty":
                continue
            if i + 1 >= len(instrument_events):
                continue
            next_event = instrument_events[i + 1]
            if classify_state(next_event.get("status_to")) != "available":
                continue
            clean_ms = int(next_event["change_at_ms"])
            duration_min = (clean_ms - int(event["change_at_ms"])) / 60_000
            if not 0 < duration_min < _MAX_TTC_MINUTES:
                continue
            # Assign to the local-day bucket of the clean event
            clean_local = datetime.fromtimestamp(clean_ms / 1000, tz=dt_timezone.utc).astimezone(tz)
            clean_day = clean_local.replace(hour=0, minute=0, second=0, microsecond=0)
            day_offset = (local_today - clean_day).days
            if 0 <= day_offset < days:
                daily_samples[days - 1 - day_offset].append(duration_min)

    return [
        round(sum(samples) / len(samples), 1) if samples else 0.0
        for _, samples in sorted(daily_samples.items())
    ]


def build_heatmap(
    events: list[dict],
    total_instruments: int,
    now_ms: int,
    tz_name: str = "UTC",
) -> list[list[float]]:
    """Build a 7×24 activity heatmap from raw event timeline rows.

    Rows are filtered to in-use events within the last 7 days.  Each cell
    ``[day][hour]`` contains the percentage of instruments observed transitioning
    into in-use in that (local day-of-week, local hour) slot.

    Day index: 0 = Monday, 6 = Sunday.  Hour index: 0 = midnight, 23 = 11 pm.

    Args:
        events: Raw event rows from ``_q_event_timeline`` (all instruments).
        total_instruments: Denominator for percentage calculation.
        now_ms: Current UTC epoch milliseconds.
        tz_name: IANA timezone name for local day/hour alignment.

    Returns:
        ``list[7][list[24]]`` of floats (0.0–100.0).
    """
    tz = ZoneInfo(tz_name)
    window_start = now_ms - 7 * 24 * 60 * 60 * 1_000
    active_sets: dict[tuple[int, int], set[str]] = {}

    for event in events:
        ms = int(event.get("change_at_ms") or 0)
        if ms < window_start:
            continue
        if classify_state(event.get("status_to")) != "in_use":
            continue
        iid = str(event.get("instrument_id") or "")
        local_dt = datetime.fromtimestamp(ms / 1000, tz=dt_timezone.utc).astimezone(tz)
        key = (local_dt.isoweekday() - 1, local_dt.hour)  # Mon=0, Sun=6
        if key not in active_sets:
            active_sets[key] = set()
        active_sets[key].add(iid)

    denom = max(total_instruments, 1)
    grid: list[list[float]] = [[0.0] * 24 for _ in range(7)]
    for (day_idx, hour_idx), instruments in active_sets.items():
        grid[day_idx][hour_idx] = round(len(instruments) / denom * 100, 1)
    return grid


def build_equipment_register(
    instruments: list[dict],
    state_by_id: dict[str, str],
    metrics_by_id: dict[str, dict],
) -> list[dict]:
    """Combine instrument master, current states, and per-instrument metrics into the register.

    Fields with no source data default to neutral values:
    ``ftr_pct=100.0``, ``cal_due_days=None``, ``faults_7d=0``,
    ``anomaly=False``, ``criticality='C'``.

    Args:
        instruments: Rows from ``_q_instrument_master``.
        state_by_id: Mapping of instrument_id → raw STATUS_TO string.
        metrics_by_id: Mapping of instrument_id → :func:`compute_per_instrument_metrics` output.

    Returns:
        List of EquipmentItem-shaped dicts matching the frontend TypeScript type.
    """
    register = []
    for inst in instruments:
        iid = str(inst.get("INSTRUMENT_ID") or inst.get("instrument_id") or "")
        raw_state = state_by_id.get(iid)
        state = classify_state(raw_state) if raw_state else "unknown"
        sub_type = inst.get("EQUIPMENT_SUB_TYPE") or inst.get("equipment_sub_type")
        eq_type = (
            inst.get("EQUIPMENT_TYPE")
            or inst.get("equipment_type")
            or (SUBTYPE_TO_TYPE.get(sub_type, UNCATEGORISED) if sub_type else UNCATEGORISED)
        )
        metrics = metrics_by_id.get(iid, {})
        register.append({
            "id":              iid,
            "name":            str(inst.get("INSTRUMENT_NAME") or inst.get("instrument_name") or iid),
            "type":            str(eq_type or UNCATEGORISED),
            "state":           state,
            "line":            str(inst.get("PRODUCTION_LINE") or inst.get("production_line") or ""),
            "ttc_min":         metrics.get("ttc_min", 0.0),
            "utilisation_pct": metrics.get("utilisation_pct", 0.0),
            "ftr_pct":         100.0,
            "mtbc_h":          metrics.get("mtbc_h", 0.0),
            "last_clean_ms":   metrics.get("last_clean_ms", 0),
            "cal_due_days":    None,
            "faults_7d":       0,
            "anomaly":         False,
            "criticality":     "C",
            "dirty_age_min":   metrics.get("dirty_age_min"),
        })
    return register


def build_type_agg(register: list[dict]) -> list[dict]:
    """Aggregate per-type stats: count, avg_ttc_min, avg_util_pct, dirty count.

    Args:
        register: Output of :func:`build_equipment_register`.

    Returns:
        List of ``{type, count, avg_ttc_min, avg_util_pct, dirty}`` dicts,
        sorted descending by count.
    """
    groups: dict[str, list[dict]] = defaultdict(list)
    for item in register:
        groups[item["type"]].append(item)
    result = []
    for eq_type, items in sorted(groups.items(), key=lambda x: -len(x[1])):
        n = len(items)
        result.append({
            "type":         eq_type,
            "count":        n,
            "avg_ttc_min":  round(sum(i["ttc_min"] for i in items) / n, 1) if n else 0.0,
            "avg_util_pct": round(sum(i["utilisation_pct"] for i in items) / n, 1) if n else 0.0,
            "dirty":        sum(1 for i in items if i["state"] == "dirty"),
        })
    return result


def build_kpis(register: list[dict]) -> dict:
    """Compute the KPI summary dict from the equipment register.

    FTR and calibration KPIs default to their neutral values because no
    data source is available for them in the current gold layer.

    Args:
        register: Output of :func:`build_equipment_register`.

    Returns:
        Dict matching the ``EquipmentInsights2Kpis`` frontend TypeScript type.
    """
    n = len(register)
    dirty = [i for i in register if i["state"] == "dirty"]
    ttc_vals = [i["ttc_min"] for i in register if i["ttc_min"] > 0]
    util_vals = [i["utilisation_pct"] for i in register]
    return {
        "avg_ttc_min":         round(sum(ttc_vals) / len(ttc_vals), 1) if ttc_vals else 0.0,
        "avg_ftr_pct":         100.0,
        "avg_utilisation_pct": round(sum(util_vals) / n, 1) if n else 0.0,
        "dirty_count":         len(dirty),
        "dirty_over_4h":       sum(1 for i in dirty if (i["dirty_age_min"] or 0) > 240),
        "cal_overdue":         0,
        "cal_due_soon":        0,
        "total_dirty_time_min": round(sum((i["dirty_age_min"] or 0) for i in dirty), 1),
        "anomaly_count":       0,
    }
