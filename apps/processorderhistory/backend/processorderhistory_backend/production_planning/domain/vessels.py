"""Domain rules for vessel planning state and feasibility projections."""

from __future__ import annotations

from typing import Callable, Optional


CapacityCheck = Callable[[str, float, Optional[str]], tuple[bool, str]]

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


def classify_state(status_to: Optional[str], order_status: Optional[str]) -> str:
    """Classify vessel state from status text and current order status."""

    if order_status == "running":
        return "IN_USE"
    if not status_to:
        return "UNKNOWN"
    upper = status_to.upper()
    if any(keyword in upper for keyword in IN_USE_KEYWORDS):
        return "IN_USE"
    if any(keyword in upper for keyword in DIRTY_KEYWORDS):
        return "DIRTY"
    if any(keyword in upper for keyword in AVAILABLE_KEYWORDS):
        return "AVAILABLE"
    return "UNKNOWN"


def coerce_event_row(row: dict) -> dict:
    """Coerce Databricks string-serialised values in an equipment event row."""

    value = row.get("change_at_ms")
    row["change_at_ms"] = int(value) if value is not None else 0
    row["instrument_id"] = str(row.get("instrument_id") or "")
    row["process_order_id"] = str(row.get("process_order_id") or "") or None
    row["material_id"] = str(row.get("material_id") or "") or None
    return row


def coerce_int_ms(value: object) -> Optional[int]:
    """Safely coerce a nullable epoch-ms value to int."""

    return int(value) if value is not None else None


def state_reason(state: str, status_to, order_status, po_id) -> str:
    """Return a human-readable explanation for why this vessel state was assigned."""

    if order_status == "running":
        return f"Running PO {po_id or 'unknown'}"
    if state == "IN_USE":
        return f"STATUS_TO matched in-use keyword: {status_to!r}"
    if state == "DIRTY":
        return f"STATUS_TO matched dirty keyword: {status_to!r}"
    if state == "AVAILABLE":
        return f"STATUS_TO matched available keyword: {status_to!r}"
    if not status_to:
        return "No STATUS_TO value recorded"
    return f"STATUS_TO {status_to!r} — no keyword match"


def _default_capacity_check(instrument_id: str, order_qty: float, plant_id: Optional[str]) -> tuple[bool, str]:
    return True, f"{instrument_id}: capacity not validated for {order_qty:g} at {plant_id or 'any plant'}"


def derive_planning_data(
    latest_rows: list[dict],
    events_rows: list[dict],
    released_rows: list[dict],
    *,
    capacity_check: CapacityCheck | None = None,
) -> tuple[list[dict], list[dict], dict]:
    """Derive vessel states, enriched released orders, and KPIs from raw query results."""

    if capacity_check is None:
        capacity_check = _default_capacity_check

    vessel_states: dict[str, dict] = {}
    for row in latest_rows:
        instrument_id = str(row.get("instrument_id") or "")
        if not instrument_id:
            continue
        state = classify_state(row.get("status_to"), row.get("order_status"))
        vessel_states[instrument_id] = {
            "instrument_id": instrument_id,
            "equipment_type": row.get("equipment_type"),
            "state": state,
            "state_reason": state_reason(
                state,
                row.get("status_to"),
                row.get("order_status"),
                str(row.get("process_order_id") or "") or None,
            ),
            "current_po_id": str(row.get("process_order_id") or "") or None,
            "current_material_id": str(row.get("material_id") or "") or None,
            "current_material_name": str(row.get("material_name") or "") or None,
            "state_since_ms": coerce_int_ms(row.get("change_at_ms")),
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

    affinity_map: dict[str, dict[str, int]] = {}
    material_names: dict[str, str] = {}
    material_last_seen: dict[str, int] = {}
    for row in events_rows:
        material_id = str(row.get("material_id") or "")
        instrument_id = str(row.get("instrument_id") or "")
        if not material_id or not instrument_id:
            continue
        affinity_map.setdefault(material_id, {})
        affinity_map[material_id][instrument_id] = affinity_map[material_id].get(instrument_id, 0) + 1
        if row.get("material_name"):
            material_names[material_id] = str(row["material_name"])
        timestamp = int(row.get("change_at_ms") or 0)
        if timestamp > material_last_seen.get(material_id, 0):
            material_last_seen[material_id] = timestamp

    vessel_top_materials: dict[str, list[dict]] = {}
    for material_id, vessel_counts in affinity_map.items():
        for instrument_id, count in vessel_counts.items():
            vessel_top_materials.setdefault(instrument_id, [])
            vessel_top_materials[instrument_id].append({
                "material_id": material_id,
                "material_name": material_names.get(material_id, material_id),
                "use_count": count,
            })
    for instrument_id, entries in vessel_top_materials.items():
        entries.sort(key=lambda entry: entry["use_count"], reverse=True)
        if instrument_id in vessel_states:
            vessel_states[instrument_id]["affinity_materials"] = entries[:10]
            vessel_states[instrument_id]["top_affinity_material_count"] = len(entries)

    released_enriched: list[dict] = []
    constrained_po_ids: set[str] = set()
    unblock_actions: set[str] = set()

    for index, row in enumerate(released_rows):
        po_id = str(row.get("po_id") or "")
        material_id = str(row.get("material_id") or "")
        material_name = str(row.get("material_name") or po_id)
        scheduled_start_ms = coerce_int_ms(row.get("scheduled_start_ms"))
        plant_id = row.get("plant_id")
        order_qty: Optional[float] = None

        sorted_affinity = sorted(
            affinity_map.get(material_id, {}).items(),
            key=lambda item: item[1],
            reverse=True,
        )
        all_affinity_vessels = [instrument_id for instrument_id, _ in sorted_affinity]
        likely_vessels = all_affinity_vessels[:5]
        has_affinity = bool(likely_vessels)
        evidence_notes: list[str] = []

        if order_qty is not None:
            filtered_vessels: list[str] = []
            for instrument_id in likely_vessels:
                fits, note = capacity_check(instrument_id, order_qty, plant_id)
                if fits:
                    filtered_vessels.append(instrument_id)
                else:
                    evidence_notes.append(note)
            likely_vessels = filtered_vessels
        else:
            evidence_notes.append("capacity not validated — order quantity unavailable")

        def affinity_rank(instrument_id: str) -> Optional[int]:
            for rank, (vessel_id, _) in enumerate(sorted_affinity, start=1):
                if vessel_id == instrument_id:
                    return rank
            return None

        available = [v for v in likely_vessels if vessel_states.get(v, {}).get("state") == "AVAILABLE"]
        dirty = [v for v in likely_vessels if vessel_states.get(v, {}).get("state") == "DIRTY"]
        in_use = [v for v in likely_vessels if vessel_states.get(v, {}).get("state") == "IN_USE"]

        if available:
            affinity_count = affinity_map.get(material_id, {}).get(available[0], 0)
            feasible = True
            constraint_type = None
            recommended_vessel = available[0]
            recommendation = (
                f"Assign to {available[0]} — "
                f"{affinity_count} prior use{'s' if affinity_count != 1 else ''}"
            )
            confidence = "high" if affinity_count >= 3 else "medium" if affinity_count >= 1 else "low"
            evidence_rank = affinity_rank(available[0])
        elif dirty:
            affinity_count = affinity_map.get(material_id, {}).get(dirty[0], 0)
            feasible = False
            constraint_type = "dirty_vessel"
            recommended_vessel = dirty[0]
            recommendation = f"Schedule CIP cleaning for {dirty[0]}, then assign"
            confidence = "high" if has_affinity else "medium"
            evidence_rank = affinity_rank(dirty[0])
            constrained_po_ids.add(po_id)
            unblock_actions.add(f"clean:{dirty[0]}")
        elif in_use:
            in_use_po = vessel_states.get(in_use[0], {}).get("current_po_id")
            affinity_count = affinity_map.get(material_id, {}).get(in_use[0], 0)
            feasible = False
            constraint_type = "in_use_vessel"
            recommended_vessel = in_use[0]
            recommendation = (
                f"Expedite current order on {in_use[0]}"
                + (f" (PO {in_use_po})" if in_use_po else "")
            )
            confidence = "high" if has_affinity else "medium"
            evidence_rank = affinity_rank(in_use[0])
            constrained_po_ids.add(po_id)
            if in_use_po:
                unblock_actions.add(f"expedite:{in_use_po}")
        else:
            affinity_count = 0
            feasible = False
            constraint_type = "no_vessel" if not has_affinity else "in_use_vessel"
            recommended_vessel = None
            recommendation = (
                "No vessel affinity data — manual assignment required"
                if not has_affinity
                else "All known vessels are busy or dirty"
            )
            confidence = "low" if not has_affinity else "medium"
            evidence_rank = None
            constrained_po_ids.add(po_id)

        released_enriched.append({
            "po_id": po_id,
            "material_id": material_id or None,
            "material_name": material_name,
            "plant_id": plant_id,
            "scheduled_start_ms": scheduled_start_ms,
            "rank": index + 1,
            "feasible": feasible,
            "constraint_type": constraint_type,
            "likely_vessels": likely_vessels,
            "recommended_vessel": recommended_vessel,
            "recommendation": recommendation,
            "heuristic_confidence": confidence,
            "evidence_affinity_count": affinity_count,
            "evidence_affinity_rank": evidence_rank,
            "evidence_candidate_vessel_count": len(all_affinity_vessels),
            "evidence_last_seen_at_ms": material_last_seen.get(material_id) if material_id else None,
            "evidence_source": "affinity_history" if has_affinity else "no_affinity_data",
            "evidence_notes": evidence_notes,
        })

    vessel_blocked: dict[str, list[dict]] = {}
    for process_order in released_enriched:
        if process_order["feasible"]:
            continue
        for instrument_id in process_order["likely_vessels"]:
            if vessel_states.get(instrument_id, {}).get("state") in ("DIRTY", "IN_USE", "UNKNOWN"):
                vessel_blocked.setdefault(instrument_id, [])
                if len(vessel_blocked[instrument_id]) < 10:
                    vessel_blocked[instrument_id].append({
                        "po_id": process_order["po_id"],
                        "material_name": process_order["material_name"],
                        "scheduled_start_ms": process_order["scheduled_start_ms"],
                    })

    for instrument_id, info in vessel_states.items():
        blocked = vessel_blocked.get(instrument_id, [])
        info["blocked_orders"] = blocked
        info["blocked_order_count"] = len(blocked)
        state = info["state"]
        if state == "DIRTY":
            info["recommended_action"] = f"Schedule CIP cleaning for {instrument_id}"
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

    vessel_list = list(vessel_states.values())
    kpis = {
        "released_po_count": len(released_rows),
        "constrained_po_count": len(constrained_po_ids),
        "available_vessel_count": sum(1 for vessel in vessel_list if vessel["state"] == "AVAILABLE"),
        "dirty_vessel_count": sum(1 for vessel in vessel_list if vessel["state"] == "DIRTY"),
        "in_use_vessel_count": sum(1 for vessel in vessel_list if vessel["state"] == "IN_USE"),
        "unknown_vessel_count": sum(1 for vessel in vessel_list if vessel["state"] == "UNKNOWN"),
        "unblock_action_count": len(unblock_actions),
    }

    return vessel_list, released_enriched, kpis
