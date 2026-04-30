"""DAL for vessel planning analytics â equipment state, material-vessel affinity, and constrained order queue.

Runs 3 Databricks queries in parallel (asyncio.gather):
  1. latest_states   â most recent equipment event per vessel (90-day ROW_NUMBER CTE) for live state
  2. events_range    â equipment events in the user-selected date range (history table and affinity)
  3. released_orders â released process orders with optional silver SCHEDULED_START for priority ranking

Vessel state classification, material-vessel affinity, priority queue, and
constrained-order recommendations are all derived in Python.  No new Databricks
views are required â all logic lives in the application layer.

Vessel state heuristic (keyword-based, UNKNOWN fallback):
  IN_USE    â STATUS_TO contains running/use/occupied/production keywords, or associated PO is running
  DIRTY     â STATUS_TO contains dirty/unclean/cip-required keywords
  AVAILABLE â STATUS_TO contains available/clean/free/ready keywords
  UNKNOWN   â no keyword match (data insufficient for classification)

Material-vessel affinity is derived by counting (INSTRUMENT_ID, MATERIAL_ID) co-occurrence
in the events_range dataset.  Released-order feasibility is assessed against affinity-ranked
vessel states.
"""
import asyncio
from datetime import datetime, timezone as dt_timezone
from typing import Optional

from backend.db import run_sql_async, silver_tbl, sql_param, tbl, tz_date
from backend.config.vessel_capacity import VESSEL_CAPACITY, check_capacity, get_vessel_capacity

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
    JOIN to vw_gold_process_order â vessels whose most recent event has no associated
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
              AND EQUIPMENT_TYPE != 'Single-Use Vessel'
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
    Used for material-vessel affinity derivation.
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
        WHERE eh.EQUIPMENT_TYPE != 'Single-Use Vessel'
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

    LEFT JOINs silver_process_order for SCHEDULED_START â degrades gracefully to
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


# ---------------------------------------------------------------------------
# Vessel state classifier
# ---------------------------------------------------------------------------

def _classify_state(status_to: Optional[str], order_status: Optional[str]) -> str:
    """Classify vessel state from STATUS_TO keyword heuristics and current order status.

    Running process order overrides keyword classification to IN_USE â a vessel
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

def _state_reason(state: str, status_to, order_status, po_id) -> str:
    """Return a human-readable explanation for why this vessel state was assigned."""
    if order_status == 'running':
        return f"Running PO {po_id or 'unknown'}"
    if state == 'IN_USE':
        return f"STATUS_TO matched in-use keyword: {status_to!r}"
    if state == 'DIRTY':
        return f"STATUS_TO matched dirty keyword: {status_to!r}"
    if state == 'AVAILABLE':
        return f"STATUS_TO matched available keyword: {status_to!r}"
    if not status_to:
        return "No STATUS_TO value recorded"
    return f"STATUS_TO {status_to!r} — no keyword match"


def _derive_planning_data(
    latest_rows: list[dict],
    events_rows: list[dict],
    released_rows: list[dict],
    capacity_config: Optional[list[dict]] = None,
) -> tuple[list[dict], list[dict], dict]:
    """Derive vessel states, enriched released orders, and KPIs from raw query results.

    Returns (vessels, released_orders_enriched, kpis).

    Vessel state is derived from latest_rows (ROW_NUMBER latest event per vessel).
    Material-vessel affinity counts are derived from events_rows (historical co-occurrence).
    Released order feasibility, constraint classification, evidence fields, and recommendations
    are derived by crossing released_rows against affinity and vessel states.

    ``capacity_config`` is an optional list of vessel capacity dicts (from
    ``backend.config.vessel_capacity``).  When an order quantity is unknown (currently
    always — no confirmed gold-layer quantity field on released POs), capacity filtering
    degrades gracefully: candidates are not excluded but an evidence note is added.
    """
    if capacity_config is None:
        capacity_config = []

    # 1. Build vessel state map keyed by instrument_id.
    vessel_states: dict[str, dict] = {}
    for row in latest_rows:
        iid = str(row.get("instrument_id") or "")
        if not iid:
            continue
        state = _classify_state(row.get("status_to"), row.get("order_status"))
        vessel_states[iid] = {
            "instrument_id": iid,
            "equipment_type": row.get("equipment_type"),
            "state": state,
            "state_reason": _state_reason(
                state, row.get("status_to"), row.get("order_status"),
                str(row.get("process_order_id") or "") or None,
            ),
            "current_po_id": str(row.get("process_order_id") or "") or None,
            "current_material_id": str(row.get("material_id") or "") or None,
            "current_material_name": str(row.get("material_name") or "") or None,
            "state_since_ms": _coerce_int_ms(row.get("change_at_ms")),
            "status_to": row.get("status_to"),
            "status_from": row.get("status_from"),
            "affinity_materials": [],
            "blocked_orders": [],
            "blocked_order_count": 0,
            "top_affinity_material_count": 0,
            "recommended_action": None,
            "action_reason": None,
            "action_priority": None,
        }

    # 2. Build material-vessel affinity from events_range.
    #    affinity_map: {material_id -> {instrument_id -> count}}
    #    material_last_seen: {material_id -> max change_at_ms}
    affinity_map: dict[str, dict[str, int]] = {}
    material_names: dict[str, str] = {}
    material_last_seen: dict[str, int] = {}
    for row in events_rows:
        mid = str(row.get("material_id") or "")
        iid = str(row.get("instrument_id") or "")
        if not mid or not iid:
            continue
        affinity_map.setdefault(mid, {})
        affinity_map[mid][iid] = affinity_map[mid].get(iid, 0) + 1
        if row.get("material_name"):
            material_names[mid] = str(row["material_name"])
        ts = int(row.get("change_at_ms") or 0)
        if ts > material_last_seen.get(mid, 0):
            material_last_seen[mid] = ts

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
            vessel_states[iid]["top_affinity_material_count"] = len(entries)

    # 4. Enrich released orders: feasibility, constraint, evidence, recommendations.
    released_enriched: list[dict] = []
    constrained_po_ids: set[str] = set()
    unblock_actions: set[str] = set()

    # Vessel IDs that have a capacity config entry.
    configured_vessels: set[str] = {c["instrument_id"] for c in capacity_config}

    for i, row in enumerate(released_rows):
        po_id = str(row.get("po_id") or "")
        mid = str(row.get("material_id") or "")
        material_name = str(row.get("material_name") or po_id)
        scheduled_start_ms = _coerce_int_ms(row.get("scheduled_start_ms"))
        plant_id = row.get("plant_id")

        # Order quantity: not available from current data sources — always None.
        # Capacity filtering activates automatically when this is populated.
        order_qty: Optional[float] = None

        # Affinity candidates sorted by historical co-occurrence count.
        sorted_affinity = sorted(
            affinity_map.get(mid, {}).items(),
            key=lambda kv: kv[1],
            reverse=True,
        )
        all_affinity_vessels = [iid for iid, _ in sorted_affinity]
        likely_vessels = all_affinity_vessels[:5]
        has_affinity = bool(likely_vessels)

        # Evidence notes accumulated throughout derivation.
        evidence_notes: list[str] = []

        # Capacity filtering — degrades gracefully when order_qty is unknown.
        if order_qty is not None:
            filtered: list[str] = []
            for iid in likely_vessels:
                fits, note = check_capacity(iid, order_qty, plant_id)
                if fits:
                    filtered.append(iid)
                else:
                    evidence_notes.append(note)
            likely_vessels = filtered
        else:
            evidence_notes.append("capacity not validated — order quantity unavailable")

        def _affinity_rank(iid: str) -> Optional[int]:
            for rank, (vid, _) in enumerate(sorted_affinity, start=1):
                if vid == iid:
                    return rank
            return None

        available = [v for v in likely_vessels if vessel_states.get(v, {}).get("state") == "AVAILABLE"]
        dirty = [v for v in likely_vessels if vessel_states.get(v, {}).get("state") == "DIRTY"]
        in_use = [v for v in likely_vessels if vessel_states.get(v, {}).get("state") == "IN_USE"]

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
            ev_rank = _affinity_rank(available[0])
        elif dirty:
            aff_count = affinity_map.get(mid, {}).get(dirty[0], 0)
            feasible = False
            constraint_type = "dirty_vessel"
            recommended_vessel = dirty[0]
            recommendation = f"Schedule CIP cleaning for {dirty[0]}, then assign"
            confidence = "high" if has_affinity else "medium"
            ev_rank = _affinity_rank(dirty[0])
            constrained_po_ids.add(po_id)
            unblock_actions.add(f"clean:{dirty[0]}")
        elif in_use:
            in_use_po = vessel_states.get(in_use[0], {}).get("current_po_id")
            aff_count = affinity_map.get(mid, {}).get(in_use[0], 0)
            feasible = False
            constraint_type = "in_use_vessel"
            recommended_vessel = in_use[0]
            recommendation = (
                f"Expedite current order on {in_use[0]}"
                + (f" (PO {in_use_po})" if in_use_po else "")
            )
            confidence = "high" if has_affinity else "medium"
            ev_rank = _affinity_rank(in_use[0])
            constrained_po_ids.add(po_id)
            if in_use_po:
                unblock_actions.add(f"expedite:{in_use_po}")
        else:
            aff_count = 0
            feasible = False
            constraint_type = "no_vessel" if not has_affinity else "in_use_vessel"
            recommended_vessel = None
            recommendation = (
                "No vessel affinity data — manual assignment required"
                if not has_affinity
                else "All known vessels are busy or dirty"
            )
            confidence = "low" if not has_affinity else "medium"
            ev_rank = None
            constrained_po_ids.add(po_id)

        released_enriched.append({
            "po_id": po_id,
            "material_id": mid or None,
            "material_name": material_name,
            "plant_id": plant_id,
            "scheduled_start_ms": scheduled_start_ms,
            "rank": i + 1,
            "feasible": feasible,
            "constraint_type": constraint_type,
            "likely_vessels": likely_vessels,
            "recommended_vessel": recommended_vessel,
            "recommendation": recommendation,
            "heuristic_confidence": confidence,
            "evidence_affinity_count": aff_count,
            "evidence_affinity_rank": ev_rank,
            "evidence_candidate_vessel_count": len(all_affinity_vessels),
            "evidence_last_seen_at_ms": material_last_seen.get(mid) if mid else None,
            "evidence_source": "affinity_history" if has_affinity else "no_affinity_data",
            "evidence_notes": evidence_notes,
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
        blocked = vessel_blocked.get(iid, [])
        info["blocked_orders"] = blocked
        info["blocked_order_count"] = len(blocked)
        state = info["state"]
        if state == "DIRTY":
            info["recommended_action"] = f"Schedule CIP cleaning for {iid}"
            info["action_reason"] = (
                f"{len(blocked)} released order{'s' if len(blocked) != 1 else ''} waiting"
                if blocked else "vessel requires cleaning before use"
            )
            info["action_priority"] = 2
        elif state == "IN_USE":
            current_po = info.get("current_po_id")
            info["recommended_action"] = (
                f"Expedite PO {current_po} to free vessel" if current_po else None
            )
            info["action_reason"] = (
                f"{len(blocked)} released order{'s' if len(blocked) != 1 else ''} waiting"
                if blocked else None
            )
            info["action_priority"] = 1 if blocked else 3
        else:
            info["recommended_action"] = None
            info["action_reason"] = None
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
    """Fetch vessel planning analytics via 3 parallel Databricks queries.

    Returns:
      - ``vessels``         â per-vessel state, affinity, blocked orders, and recommended action
      - ``released_orders`` â priority-ranked released POs with feasibility assessment
      - ``kpis``            â summary counts for the KPI strip
      - ``now_ms``          â server-side current epoch ms for age calculations

    ``timezone`` is a validated IANA timezone name used for date-range filtering.
    """
    now_ms = int(datetime.now(dt_timezone.utc).timestamp() * 1000)

    latest_rows, events_rows, released_rows = await asyncio.gather(
        _q_latest_states(token, plant_id),
        _q_events_range(token, date_from, date_to, plant_id, timezone),
        _q_released_orders(token, plant_id),
    )

    events_coerced = [_coerce_event_row(r) for r in events_rows]
    latest_coerced = [_coerce_event_row(r) for r in latest_rows]

    vessels, released_enriched, kpis = _derive_planning_data(
        latest_coerced, events_coerced, released_rows,
        capacity_config=VESSEL_CAPACITY,
    )

    return {
        "now_ms": now_ms,
        "kpis": kpis,
        "vessels": sorted(vessels, key=lambda v: (
            {"IN_USE": 0, "DIRTY": 1, "UNKNOWN": 2, "AVAILABLE": 3}.get(v["state"], 4),
            v["instrument_id"],
        )),
        "released_orders": released_enriched,
    }
