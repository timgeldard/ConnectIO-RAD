"""DAL for vessel planning analytics — equipment state, material-vessel affinity, and constrained order queue.

Runs 4 Databricks queries in parallel (asyncio.gather):
  1. latest_states   — most recent equipment event per vessel (90-day ROW_NUMBER CTE) for live state
  2. events_range    — equipment events in the user-selected date range (history table and affinity)
  3. released_orders — released process orders with optional silver SCHEDULED_START for priority ranking
  4. daily30d        — daily equipment event count over last 30 days (activity trend chart)

Vessel state classification, material-vessel affinity, priority queue, and
constrained-order recommendations are all derived in Python.  No new Databricks
views are required — all logic lives in the application layer.

Vessel state heuristic (keyword-based, UNKNOWN fallback):
  IN_USE    — STATUS_TO contains running/use/occupied/production keywords, or associated PO is running
  DIRTY     — STATUS_TO contains dirty/unclean/cip-required keywords
  AVAILABLE — STATUS_TO contains available/clean/free/ready keywords
  UNKNOWN   — no keyword match (data insufficient for classification)

Material-vessel affinity is derived by counting (INSTRUMENT_ID, MATERIAL_ID) co-occurrence
in the events_range dataset.  Released-order feasibility is assessed against affinity-ranked
vessel states.
"""
import asyncio
from datetime import datetime, timedelta, timezone as dt_timezone
from typing import Optional
from zoneinfo import ZoneInfo

from backend.db import run_sql_async, silver_tbl, sql_param, tbl, tz_day_ms, tz_date

_MS_PER_DAY = 86_400_000

# Keyword sets for vessel state heuristic classification (matched against upper-cased STATUS_TO).
_IN_USE_KEYWORDS = frozenset({
    'IN USE', 'IN-USE', 'INUSE', 'RUNNING', 'OCCUPIED', 'ACTIVE', 'PRODUCTION', 'PROCESS',
    'IN PRODUCTION', 'IN PROCESS',
})
_DIRTY_KEYWORDS = frozenset({
    'DIRTY', 'UNCLEAN', 'CLEAN REQUIRED', 'NEEDS CLEAN', 'NEED CLEAN',
    'CIP REQUIRED', 'SOAKING', 'RINSE', 'AWAITING CLEAN',
})
_AVAILABLE_KEYWORDS = frozenset({
    'AVAILABLE', 'CLEAN', 'FREE', 'READY', 'IDLE', 'EMPTY',
    'SANITISED', 'SANITIZED', 'CLEANED',
})

# CASE expression returning a nullable UI-status string.
# Uses ``eh`` for the equipment-history alias and ``po`` for the process-order JOIN.
_EH_ORDER_STATUS_EXPR = """
    CASE
        WHEN eh.PROCESS_ORDER_ID IS NULL THEN NULL
        WHEN po.PROCESS_ORDER_ID IS NULL THEN NULL
        WHEN po.STATUS IN ('IN PROGRESS', 'Tulip Load In Progress') THEN 'running'
        WHEN po.STATUS IN ('COMPLETED', 'CLOSED') THEN 'completed'
        WHEN po.STATUS = 'ON HOLD' THEN 'onhold'
        WHEN po.STATUS = 'CANCELLED' THEN 'cancelled'
        ELSE 'released'
    END
""".strip()

# Same expression for the latest-states CTE that uses ``leh`` as the alias.
_LEH_ORDER_STATUS_EXPR = """
    CASE
        WHEN leh.PROCESS_ORDER_ID IS NULL THEN NULL
        WHEN po.PROCESS_ORDER_ID IS NULL THEN NULL
        WHEN po.STATUS IN ('IN PROGRESS', 'Tulip Load In Progress') THEN 'running'
        WHEN po.STATUS IN ('COMPLETED', 'CLOSED') THEN 'completed'
        WHEN po.STATUS = 'ON HOLD' THEN 'onhold'
        WHEN po.STATUS = 'CANCELLED' THEN 'cancelled'
        ELSE 'released'
    END
""".strip()


# ---------------------------------------------------------------------------
# Individual query coroutines
# ---------------------------------------------------------------------------

async def _q_latest_states(token: str, plant_id: Optional[str]) -> list[dict]:
    """Most recent equipment event per INSTRUMENT_ID over the last 90 days.

    Uses ROW_NUMBER() OVER (PARTITION BY INSTRUMENT_ID ORDER BY CHANGE_AT DESC) to
    select one row per vessel.  Plant filtering is applied best-effort via the LEFT
    JOIN to vw_gold_process_order — vessels whose most recent event has no associated
    PO are included regardless of the plant filter.
    """
    plant_clause = "AND (po.PLANT_ID = :plant_id OR po.PLANT_ID IS NULL)" if plant_id else ""
    params: Optional[list[dict]] = [sql_param("plant_id", plant_id)] if plant_id else None

    query = f"""
        WITH latest_eh AS (
            SELECT
                INSTRUMENT_ID,
                EQUIPMENT_TYPE,
                STATUS_FROM,
                STATUS_TO,
                CHANGE_AT,
                PROCESS_ORDER_ID,
                ROW_NUMBER() OVER (PARTITION BY INSTRUMENT_ID ORDER BY CHANGE_AT DESC) AS rn
            FROM {tbl('vw_gold_equipment_history')}
            WHERE CHANGE_AT >= current_timestamp() - INTERVAL 90 DAYS
        )
        SELECT
            leh.INSTRUMENT_ID          AS instrument_id,
            leh.EQUIPMENT_TYPE         AS equipment_type,
            leh.STATUS_FROM            AS status_from,
            leh.STATUS_TO              AS status_to,
            CAST(UNIX_TIMESTAMP(leh.CHANGE_AT) * 1000 AS BIGINT) AS change_at_ms,
            leh.PROCESS_ORDER_ID       AS process_order_id,
            po.MATERIAL_ID             AS material_id,
            COALESCE(m.MATERIAL_NAME, po.MATERIAL_DESCRIPTION) AS material_name,
            po.PLANT_ID                AS plant_id,
            {_LEH_ORDER_STATUS_EXPR}   AS order_status
        FROM latest_eh leh
        LEFT JOIN {tbl('vw_gold_process_order')} po
            ON po.PROCESS_ORDER_ID = leh.PROCESS_ORDER_ID
        LEFT JOIN {tbl('vw_gold_material')} m
            ON m.MATERIAL_ID = po.MATERIAL_ID
           AND m.LANGUAGE_ID = 'E'
        WHERE leh.rn = 1
          {plant_clause}
        ORDER BY leh.INSTRUMENT_ID
    """
    return await run_sql_async(token, query, params, endpoint_hint="poh.vessels.latest_states")


async def _q_events_range(
    token: str,
    date_from: Optional[str],
    date_to: Optional[str],
    plant_id: Optional[str],
    tz: str,
) -> list[dict]:
    """Equipment events in the user's selected date range.

    Falls back to a 30-day rolling window when no dates are supplied.
    Used for the history table and material-vessel affinity derivation.
    Plant filtering is applied best-effort via po.PLANT_ID.
    """
    if date_from and date_to:
        date_clause = (
            f"AND {tz_date('eh.CHANGE_AT', tz)} >= :date_from"
            f" AND {tz_date('eh.CHANGE_AT', tz)} <= :date_to"
        )
        params: list[dict] = [sql_param("date_from", date_from), sql_param("date_to", date_to)]
    else:
        date_clause = "AND eh.CHANGE_AT >= current_timestamp() - INTERVAL 30 DAYS"
        params = []

    plant_clause = "AND po.PLANT_ID = :plant_id" if plant_id else ""
    if plant_id:
        params.append(sql_param("plant_id", plant_id))

    query = f"""
        SELECT
            eh.INSTRUMENT_ID          AS instrument_id,
            eh.EQUIPMENT_TYPE         AS equipment_type,
            eh.STATUS_FROM            AS status_from,
            eh.STATUS_TO              AS status_to,
            CAST(UNIX_TIMESTAMP(eh.CHANGE_AT) * 1000 AS BIGINT) AS change_at_ms,
            eh.PROCESS_ORDER_ID       AS process_order_id,
            po.MATERIAL_ID            AS material_id,
            COALESCE(m.MATERIAL_NAME, po.MATERIAL_DESCRIPTION) AS material_name,
            po.PLANT_ID               AS plant_id,
            {_EH_ORDER_STATUS_EXPR}   AS order_status
        FROM {tbl('vw_gold_equipment_history')} eh
        LEFT JOIN {tbl('vw_gold_process_order')} po
            ON po.PROCESS_ORDER_ID = eh.PROCESS_ORDER_ID
        LEFT JOIN {tbl('vw_gold_material')} m
            ON m.MATERIAL_ID = po.MATERIAL_ID
           AND m.LANGUAGE_ID = 'E'
        WHERE 1=1
          {date_clause}
          {plant_clause}
        ORDER BY eh.CHANGE_AT DESC
        LIMIT 50000
    """
    return await run_sql_async(
        token, query, params or None, endpoint_hint="poh.vessels.events_range"
    )


async def _q_released_orders(token: str, plant_id: Optional[str]) -> list[dict]:
    """Released process orders ranked by silver SCHEDULED_START.

    LEFT JOINs silver_process_order for SCHEDULED_START — degrades gracefully to
    process_order_id ordering when the silver join returns no rows.
    Excludes in-progress, completed, on-hold, and cancelled orders.
    """
    plant_clause = "AND po.PLANT_ID = :plant_id" if plant_id else ""
    params: Optional[list[dict]] = [sql_param("plant_id", plant_id)] if plant_id else None

    query = f"""
        SELECT
            po.PROCESS_ORDER_ID    AS po_id,
            po.MATERIAL_ID         AS material_id,
            COALESCE(m.MATERIAL_NAME, po.MATERIAL_DESCRIPTION, po.PROCESS_ORDER_ID)
                                   AS material_name,
            po.PLANT_ID            AS plant_id,
            CAST(UNIX_TIMESTAMP(spo.SCHEDULED_START) * 1000 AS BIGINT) AS scheduled_start_ms
        FROM {tbl('vw_gold_process_order')} po
        LEFT JOIN {tbl('vw_gold_material')} m
            ON m.MATERIAL_ID = po.MATERIAL_ID
           AND m.LANGUAGE_ID = 'E'
        LEFT JOIN {silver_tbl('silver_process_order')} spo
            ON spo.PROCESS_ORDER_ID = po.PROCESS_ORDER_ID
        WHERE po.STATUS NOT IN (
            'IN PROGRESS', 'Tulip Load In Progress',
            'COMPLETED', 'CLOSED', 'ON HOLD', 'CANCELLED'
        )
          {plant_clause}
        ORDER BY spo.SCHEDULED_START ASC NULLS LAST, po.PROCESS_ORDER_ID ASC
        LIMIT 200
    """
    return await run_sql_async(
        token, query, params, endpoint_hint="poh.vessels.released_orders"
    )


async def _q_daily30d(token: str, plant_id: Optional[str], tz: str) -> list[dict]:
    """Daily equipment event count over the last 30 days (activity trend chart).

    Plant filtering applied best-effort via po.PLANT_ID LEFT JOIN.
    """
    plant_clause = "AND po.PLANT_ID = :plant_id" if plant_id else ""
    params: Optional[list[dict]] = [sql_param("plant_id", plant_id)] if plant_id else None

    query = f"""
        SELECT
            {tz_day_ms('eh.CHANGE_AT', tz)} AS day_ms,
            COUNT(*)                         AS event_count
        FROM {tbl('vw_gold_equipment_history')} eh
        LEFT JOIN {tbl('vw_gold_process_order')} po
            ON po.PROCESS_ORDER_ID = eh.PROCESS_ORDER_ID
        WHERE eh.CHANGE_AT >= current_timestamp() - INTERVAL 30 DAYS
          {plant_clause}
        GROUP BY day_ms
        ORDER BY day_ms
    """
    return await run_sql_async(
        token, query, params, endpoint_hint="poh.vessels.daily30d"
    )


# ---------------------------------------------------------------------------
# Vessel state classifier
# ---------------------------------------------------------------------------

def _classify_state(status_to: Optional[str], order_status: Optional[str]) -> str:
    """Classify vessel state from STATUS_TO keyword heuristics and current order status.

    Running process order overrides keyword classification to IN_USE — a vessel
    with an active PO is by definition in use regardless of its logged status text.
    Returns one of: 'IN_USE', 'DIRTY', 'AVAILABLE', 'UNKNOWN'.
    """
    if order_status == 'running':
        return 'IN_USE'
    if not status_to:
        return 'UNKNOWN'
    upper = status_to.upper()
    if any(kw in upper for kw in _IN_USE_KEYWORDS):
        return 'IN_USE'
    if any(kw in upper for kw in _DIRTY_KEYWORDS):
        return 'DIRTY'
    if any(kw in upper for kw in _AVAILABLE_KEYWORDS):
        return 'AVAILABLE'
    return 'UNKNOWN'


# ---------------------------------------------------------------------------
# Coerce helpers
# ---------------------------------------------------------------------------

def _coerce_event_row(row: dict) -> dict:
    """Coerce Databricks string-serialised values in an equipment event row."""
    v = row.get("change_at_ms")
    row["change_at_ms"] = int(v) if v is not None else 0
    row["instrument_id"] = str(row.get("instrument_id") or "")
    row["process_order_id"] = str(row.get("process_order_id") or "") or None
    row["material_id"] = str(row.get("material_id") or "") or None
    return row


def _coerce_int_ms(v: object) -> Optional[int]:
    """Safely coerce a nullable epoch-ms value to int."""
    return int(v) if v is not None else None


# ---------------------------------------------------------------------------
# Derivation logic
# ---------------------------------------------------------------------------

def _derive_planning_data(
    latest_rows: list[dict],
    events_rows: list[dict],
    released_rows: list[dict],
) -> tuple[list[dict], list[dict], dict]:
    """Derive vessel states, enriched released orders, and KPIs from raw query results.

    Returns (vessels, released_orders_enriched, kpis).

    Vessel state is derived from latest_rows (ROW_NUMBER latest event per vessel).
    Material-vessel affinity counts are derived from events_rows (historical co-occurrence).
    Released order feasibility, constraint classification, and recommendations are derived
    by crossing released_rows against affinity and vessel states.
    """
    # 1. Build vessel state map keyed by instrument_id.
    vessel_states: dict[str, dict] = {}
    for row in latest_rows:
        iid = str(row.get("instrument_id") or "")
        if not iid:
            continue
        vessel_states[iid] = {
            "instrument_id": iid,
            "equipment_type": row.get("equipment_type"),
            "state": _classify_state(row.get("status_to"), row.get("order_status")),
            "current_po_id": str(row.get("process_order_id") or "") or None,
            "current_material_id": str(row.get("material_id") or "") or None,
            "current_material_name": str(row.get("material_name") or "") or None,
            "state_since_ms": _coerce_int_ms(row.get("change_at_ms")),
            "status_to": row.get("status_to"),
            "status_from": row.get("status_from"),
            "affinity_materials": [],
            "blocked_orders": [],
            "recommended_action": None,
            "action_priority": None,
        }

    # 2. Build material-vessel affinity from events_range.
    #    affinity_map: {material_id → {instrument_id → count}}
    affinity_map: dict[str, dict[str, int]] = {}
    material_names: dict[str, str] = {}
    for row in events_rows:
        mid = str(row.get("material_id") or "")
        iid = str(row.get("instrument_id") or "")
        if not mid or not iid:
            continue
        affinity_map.setdefault(mid, {})
        affinity_map[mid][iid] = affinity_map[mid].get(iid, 0) + 1
        if row.get("material_name"):
            material_names[mid] = str(row["material_name"])

    # 3. Build per-vessel affinity_materials (top materials this vessel has processed).
    vessel_top_materials: dict[str, list[dict]] = {}
    for mid, vessel_counts in affinity_map.items():
        for iid, count in vessel_counts.items():
            vessel_top_materials.setdefault(iid, [])
            vessel_top_materials[iid].append({
                "material_id": mid,
                "material_name": material_names.get(mid, mid),
                "use_count": count,
            })
    for iid, entries in vessel_top_materials.items():
        entries.sort(key=lambda x: x["use_count"], reverse=True)
        if iid in vessel_states:
            vessel_states[iid]["affinity_materials"] = entries[:10]

    # 4. Enrich released orders: feasibility, constraint classification, recommendations.
    released_enriched: list[dict] = []
    constrained_po_ids: set[str] = set()
    unblock_actions: set[str] = set()

    for i, row in enumerate(released_rows):
        po_id = str(row.get("po_id") or "")
        mid = str(row.get("material_id") or "")
        material_name = str(row.get("material_name") or po_id)
        scheduled_start_ms = _coerce_int_ms(row.get("scheduled_start_ms"))

        # Top vessel candidates by affinity count for this material.
        top_vessels = sorted(
            affinity_map.get(mid, {}).items(),
            key=lambda kv: kv[1],
            reverse=True,
        )[:5]
        likely_vessels = [iid for iid, _ in top_vessels]
        has_affinity = len(likely_vessels) > 0

        available = [
            iid for iid in likely_vessels
            if vessel_states.get(iid, {}).get("state") == "AVAILABLE"
        ]
        dirty = [
            iid for iid in likely_vessels
            if vessel_states.get(iid, {}).get("state") == "DIRTY"
        ]
        in_use = [
            iid for iid in likely_vessels
            if vessel_states.get(iid, {}).get("state") == "IN_USE"
        ]

        if available:
            aff_count = affinity_map.get(mid, {}).get(available[0], 0)
            feasible = True
            constraint_type = None
            recommended_vessel = available[0]
            recommendation = (
                f"Assign to {available[0]} — "
                f"{aff_count} prior use{'s' if aff_count != 1 else ''}"
            )
            confidence = "high" if aff_count >= 3 else "medium" if aff_count >= 1 else "low"
        elif dirty:
            aff_count = affinity_map.get(mid, {}).get(dirty[0], 0)
            feasible = False
            constraint_type = "dirty_vessel"
            recommended_vessel = dirty[0]
            recommendation = f"Schedule CIP cleaning for {dirty[0]}, then assign"
            confidence = "high" if has_affinity else "medium"
            constrained_po_ids.add(po_id)
            unblock_actions.add(f"clean:{dirty[0]}")
        elif in_use:
            in_use_po = vessel_states.get(in_use[0], {}).get("current_po_id")
            feasible = False
            constraint_type = "in_use_vessel"
            recommended_vessel = in_use[0]
            recommendation = (
                f"Expedite current order on {in_use[0]}"
                + (f" (PO {in_use_po})" if in_use_po else "")
            )
            confidence = "high" if has_affinity else "medium"
            constrained_po_ids.add(po_id)
            if in_use_po:
                unblock_actions.add(f"expedite:{in_use_po}")
        else:
            feasible = False
            constraint_type = "no_vessel" if not has_affinity else "in_use_vessel"
            recommended_vessel = None
            recommendation = (
                "No vessel affinity data — manual assignment required"
                if not has_affinity
                else "All known vessels are busy or dirty"
            )
            confidence = "low" if not has_affinity else "medium"
            constrained_po_ids.add(po_id)

        released_enriched.append({
            "po_id": po_id,
            "material_id": mid or None,
            "material_name": material_name,
            "plant_id": row.get("plant_id"),
            "scheduled_start_ms": scheduled_start_ms,
            "rank": i + 1,
            "feasible": feasible,
            "constraint_type": constraint_type,
            "likely_vessels": likely_vessels,
            "recommended_vessel": recommended_vessel,
            "recommendation": recommendation,
            "heuristic_confidence": confidence,
        })

    # 5. Compute blocked_orders per vessel and recommended_action.
    vessel_blocked: dict[str, list[dict]] = {}
    for po in released_enriched:
        if po["feasible"]:
            continue
        for iid in po["likely_vessels"]:
            if vessel_states.get(iid, {}).get("state") in ("DIRTY", "IN_USE", "UNKNOWN"):
                vessel_blocked.setdefault(iid, [])
                if len(vessel_blocked[iid]) < 10:
                    vessel_blocked[iid].append({
                        "po_id": po["po_id"],
                        "material_name": po["material_name"],
                        "scheduled_start_ms": po["scheduled_start_ms"],
                    })

    for iid, info in vessel_states.items():
        info["blocked_orders"] = vessel_blocked.get(iid, [])
        state = info["state"]
        if state == "DIRTY":
            info["recommended_action"] = f"Schedule CIP cleaning for {iid}"
            info["action_priority"] = 2
        elif state == "IN_USE":
            current_po = info.get("current_po_id")
            info["recommended_action"] = (
                f"Expedite PO {current_po} to free vessel" if current_po else None
            )
            info["action_priority"] = 1 if info["blocked_orders"] else 3
        else:
            info["recommended_action"] = None
            info["action_priority"] = None

    # 6. KPIs.
    vessel_list = list(vessel_states.values())
    kpis = {
        "released_po_count": len(released_rows),
        "constrained_po_count": len(constrained_po_ids),
        "available_vessel_count": sum(1 for v in vessel_list if v["state"] == "AVAILABLE"),
        "dirty_vessel_count": sum(1 for v in vessel_list if v["state"] == "DIRTY"),
        "in_use_vessel_count": sum(1 for v in vessel_list if v["state"] == "IN_USE"),
        "unknown_vessel_count": sum(1 for v in vessel_list if v["state"] == "UNKNOWN"),
        "unblock_action_count": len(unblock_actions),
    }

    return vessel_list, released_enriched, kpis


def _build_daily30d_series(
    daily_rows: list[dict], now_ms: int, tz_name: str = "UTC"
) -> list[dict]:
    """Build a zero-padded 30-day activity trend series.

    Bucket boundaries align to local midnight in ``tz_name``.
    """
    tz = ZoneInfo(tz_name)
    now_utc = datetime.fromtimestamp(now_ms / 1000, tz=dt_timezone.utc)
    local_today = now_utc.astimezone(tz).replace(hour=0, minute=0, second=0, microsecond=0)
    day_buckets = [
        int(
            (local_today - timedelta(days=29 - i)).astimezone(dt_timezone.utc).timestamp() * 1000
        )
        for i in range(30)
    ]

    sparse: dict[int, int] = {}
    for row in daily_rows:
        d_ms = int(row["day_ms"])
        sparse[d_ms] = sparse.get(d_ms, 0) + int(row["event_count"])

    return [{"day_ms": d, "event_count": sparse.get(d, 0)} for d in day_buckets]


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def fetch_vessel_planning_analytics(
    token: str,
    *,
    plant_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    timezone: str = "UTC",
) -> dict:
    """Fetch vessel planning analytics via 4 parallel Databricks queries.

    Returns:
      - ``vessels``         — per-vessel state, affinity, blocked orders, and recommended action
      - ``released_orders`` — priority-ranked released POs with feasibility assessment
      - ``kpis``            — summary counts for the KPI strip
      - ``daily30d``        — zero-padded 30-day equipment activity trend
      - ``equipment_events``— raw equipment events for the history table (date-range filtered)
      - ``now_ms``          — server-side current epoch ms for age calculations

    ``timezone`` is a validated IANA timezone name.  Day buckets in the trend chart
    align to local calendar boundaries in that timezone.
    """
    now_ms = int(datetime.now(dt_timezone.utc).timestamp() * 1000)

    latest_rows, events_rows, released_rows, daily_rows = await asyncio.gather(
        _q_latest_states(token, plant_id),
        _q_events_range(token, date_from, date_to, plant_id, timezone),
        _q_released_orders(token, plant_id),
        _q_daily30d(token, plant_id, timezone),
    )

    events_coerced = [_coerce_event_row(r) for r in events_rows]
    latest_coerced = [_coerce_event_row(r) for r in latest_rows]

    vessels, released_enriched, kpis = _derive_planning_data(
        latest_coerced, events_coerced, released_rows
    )
    daily30d = _build_daily30d_series(daily_rows, now_ms, timezone)

    return {
        "now_ms": now_ms,
        "kpis": kpis,
        "vessels": sorted(vessels, key=lambda v: (
            {"IN_USE": 0, "DIRTY": 1, "UNKNOWN": 2, "AVAILABLE": 3}.get(v["state"], 4),
            v["instrument_id"],
        )),
        "released_orders": released_enriched,
        "daily30d": daily30d,
        "equipment_events": events_coerced,
    }
