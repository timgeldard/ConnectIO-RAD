"""Domain rules for production planning schedule projections."""

from __future__ import annotations


MS_PER_HOUR = 3_600_000
MS_PER_DAY = 86_400_000
DEFAULT_BLOCK_HRS = 8

STATUS_TO_KIND: dict[str, str | None] = {
    "IN PROGRESS": "running",
    "Tulip Load In Progress": "running",
    "COMPLETED": "completed",
    "CLOSED": "completed",
    "CANCELLED": None,
}


def coerce_block(row: dict, now_ms: int) -> dict | None:
    """Map a schedule row to the planning Gantt block contract."""

    status = row.get("order_status") or ""
    kind = STATUS_TO_KIND.get(status, "firm")
    if kind is None:
        return None

    scheduled_start_ms = row.get("scheduled_start_ms")
    start_ms = int(scheduled_start_ms) if scheduled_start_ms is not None else now_ms
    end_ms = start_ms + DEFAULT_BLOCK_HRS * MS_PER_HOUR

    po_id = str(row.get("process_order_id") or "")
    line_id = str(row.get("line_id") or "UNKNOWN")
    material_id = row.get("material_id")
    material_name = str(row.get("material_name") or po_id)

    return {
        "id": f"{po_id}-{line_id}",
        "poId": po_id,
        "lineId": line_id,
        "start": start_ms,
        "end": end_ms,
        "kind": kind,
        "label": material_name,
        "sublabel": str(material_id or ""),
        "qty": 0,
        "uom": "KG",
        "materialId": material_id,
        "customer": None,
        "shift": None,
        "operator": None,
        "ratePerH": None,
        "materials": [],
        "shortageETA": None,
        "shortageItem": None,
        "activeDowntime": None,
    }


def coerce_backlog(row: dict, due_ms: int) -> dict:
    """Map a released-order row to the backlog card contract."""

    po_id = str(row.get("process_order_id") or "")
    material_id = row.get("material_id")
    material_name = str(row.get("material_name") or po_id)
    return {
        "id": f"bl-{po_id}",
        "poId": po_id,
        "product": material_name,
        "materialId": material_id,
        "category": None,
        "qty": 0,
        "uom": "KG",
        "due": due_ms,
        "priority": "normal",
        "customer": "—",
        "requiresLine": "—",
        "durationH": DEFAULT_BLOCK_HRS,
    }


def build_kpis(blocks: list[dict], backlog: list[dict], now_ms: int) -> dict:
    """Derive production planning KPIs from block and backlog projections."""

    today_start = (now_ms // MS_PER_DAY) * MS_PER_DAY
    today_end = today_start + MS_PER_DAY

    running_count = sum(1 for block in blocks if block["kind"] == "running")
    today_blocks = [block for block in blocks if today_start <= block["start"] < today_end]
    today_qty = sum(block["qty"] for block in today_blocks)
    total_lines = len({block["lineId"] for block in blocks})

    return {
        "runningCount": running_count,
        "totalLines": total_lines,
        "todaysQty": today_qty,
        "todaysCount": len(today_blocks),
        "utilization": 0,
        "onTimePct": 0,
        "atRiskCount": 0,
        "materialShortCount": 0,
        "wmInTransit": 0,
        "downtimeMinsToday": 0,
        "activeDowntimeCount": 0,
        "backlogCount": len(backlog),
        "backlogUrgent": 0,
    }
