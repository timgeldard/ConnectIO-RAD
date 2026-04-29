"""DAL for production planning board — scheduled order Gantt data.

Runs 2 Databricks queries in parallel (asyncio.gather):
  1. blocks  — silver process orders with SCHEDULED_START in the ±7-day window,
               enriched with gold order status and material name
  2. backlog — released/unstarted process orders from the gold view (up to 30),
               representing work not yet appearing on the Gantt

Block start times come from ``silver_process_order.SCHEDULED_START``.
Block end times default to start + 8 h — no PLANNED_DURATION_HRS column has
been confirmed available in ``vw_gold_process_order`` for this app; update
``_DEFAULT_BLOCK_HRS`` (or add a query column) once confirmed queryable.

Status mapping (SAP STATUS → Gantt block kind):
  IN PROGRESS / Tulip Load In Progress → running
  COMPLETED / CLOSED                   → completed
  CANCELLED                            → excluded (returns None from coerce)
  ON HOLD / everything else            → firm
"""
import asyncio
from datetime import datetime, timezone
from typing import Optional

from backend.db import run_sql_async, silver_tbl, sql_param, tbl

_MS_PER_HOUR = 3_600_000
_MS_PER_DAY = 86_400_000
_DEFAULT_BLOCK_HRS = 8
_WINDOW_DAYS_BACK = 2
_WINDOW_DAYS_FORWARD = 5

_STATUS_TO_KIND: dict[str, str | None] = {
    "IN PROGRESS": "running",
    "Tulip Load In Progress": "running",
    "COMPLETED": "completed",
    "CLOSED": "completed",
    "CANCELLED": None,
}


# ---------------------------------------------------------------------------
# Query coroutines
# ---------------------------------------------------------------------------

async def _q_blocks(token: str, plant_id: Optional[str]) -> list[dict]:
    """Silver process orders in the planning window enriched with gold status and material."""
    plant_clause = "AND spo.PLANT_ID = :plant_id" if plant_id else ""
    params: list[dict] = [sql_param("plant_id", plant_id)] if plant_id else []

    query = f"""
        SELECT
            spo.PROCESS_ORDER_ID                                                AS process_order_id,
            COALESCE(spo.PROCESS_LINE, 'UNKNOWN')                              AS line_id,
            CAST(UNIX_TIMESTAMP(spo.SCHEDULED_START) * 1000 AS BIGINT)        AS scheduled_start_ms,
            po.STATUS                                                           AS order_status,
            po.MATERIAL_ID                                                      AS material_id,
            COALESCE(m.MATERIAL_NAME, po.MATERIAL_DESCRIPTION, spo.PROCESS_ORDER_ID)
                                                                                AS material_name
        FROM {silver_tbl('silver_process_order')} spo
        LEFT JOIN {tbl('vw_gold_process_order')} po
            ON po.PROCESS_ORDER_ID = spo.PROCESS_ORDER_ID
        LEFT JOIN {tbl('vw_gold_material')} m
            ON m.MATERIAL_ID = po.MATERIAL_ID
           AND m.LANGUAGE_ID = 'E'
        WHERE spo.SCHEDULED_START >= current_timestamp() - INTERVAL {_WINDOW_DAYS_BACK} DAYS
          AND spo.SCHEDULED_START <= current_timestamp() + INTERVAL {_WINDOW_DAYS_FORWARD} DAYS
          {plant_clause}
        ORDER BY spo.SCHEDULED_START
    """
    return await run_sql_async(token, query, params or None, endpoint_hint="poh.planning.blocks")


async def _q_backlog(token: str, plant_id: Optional[str]) -> list[dict]:
    """Released / unstarted orders from the gold view — up to 30, newest first."""
    plant_clause = "AND po.PLANT_ID = :plant_id" if plant_id else ""
    params: list[dict] = [sql_param("plant_id", plant_id)] if plant_id else []

    query = f"""
        SELECT
            po.PROCESS_ORDER_ID                                                 AS process_order_id,
            po.MATERIAL_ID                                                      AS material_id,
            COALESCE(m.MATERIAL_NAME, po.MATERIAL_DESCRIPTION, po.PROCESS_ORDER_ID)
                                                                                AS material_name
        FROM {tbl('vw_gold_process_order')} po
        LEFT JOIN {tbl('vw_gold_material')} m
            ON m.MATERIAL_ID = po.MATERIAL_ID
           AND m.LANGUAGE_ID = 'E'
        WHERE po.STATUS NOT IN (
            'IN PROGRESS', 'Tulip Load In Progress',
            'COMPLETED', 'CLOSED', 'ON HOLD', 'CANCELLED'
        )
          {plant_clause}
        ORDER BY po.PROCESS_ORDER_ID DESC
        LIMIT 30
    """
    return await run_sql_async(token, query, params or None, endpoint_hint="poh.planning.backlog")


# ---------------------------------------------------------------------------
# Coerce helpers
# ---------------------------------------------------------------------------

def _coerce_block(row: dict, now_ms: int) -> dict | None:
    """Map a blocks row to the Gantt block interface; returns None for excluded statuses."""
    status = row.get("order_status") or ""
    kind = _STATUS_TO_KIND.get(status, "firm")
    if kind is None:
        return None

    sm = row.get("scheduled_start_ms")
    start_ms = int(sm) if sm is not None else now_ms
    end_ms = start_ms + _DEFAULT_BLOCK_HRS * _MS_PER_HOUR

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


def _coerce_backlog(row: dict, due_ms: int) -> dict:
    """Map a backlog row to the backlog card interface."""
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
        "durationH": _DEFAULT_BLOCK_HRS,
    }


# ---------------------------------------------------------------------------
# KPI builder
# ---------------------------------------------------------------------------

def _build_kpis(blocks: list[dict], backlog: list[dict], now_ms: int) -> dict:
    """Derive planning KPIs from block and backlog data.

    Capacity-dependent metrics (utilization, on-time %) return 0 until a
    capacity master or schedule adherence metric view is wired in.
    """
    today_start = (now_ms // _MS_PER_DAY) * _MS_PER_DAY
    today_end = today_start + _MS_PER_DAY

    running_count = sum(1 for b in blocks if b["kind"] == "running")
    today_blocks = [b for b in blocks if today_start <= b["start"] < today_end]
    today_qty = sum(b["qty"] for b in today_blocks)
    total_lines = len({b["lineId"] for b in blocks})

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


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def fetch_planning_schedule(
    token: str,
    *,
    plant_id: Optional[str] = None,
) -> dict:
    """Fetch planning board data via 2 parallel Databricks queries.

    Returns Gantt blocks for the ±7-day window, a backlog of up to 30
    released/unstarted orders, KPIs derived from block data, and window
    boundary timestamps for the frontend to initialise its time axis.
    """
    now = datetime.now(timezone.utc)
    now_ms = int(now.timestamp() * 1000)

    block_rows, backlog_rows = await asyncio.gather(
        _q_blocks(token, plant_id),
        _q_backlog(token, plant_id),
    )

    blocks = [b for row in block_rows if (b := _coerce_block(row, now_ms)) is not None]
    due_ms = now_ms + 7 * _MS_PER_DAY
    backlog = [_coerce_backlog(row, due_ms) for row in backlog_rows]
    kpis = _build_kpis(blocks, backlog, now_ms)

    today_ms = (now_ms // _MS_PER_DAY) * _MS_PER_DAY
    window_start_ms = now_ms - _WINDOW_DAYS_BACK * _MS_PER_DAY
    window_end_ms = now_ms + _WINDOW_DAYS_FORWARD * _MS_PER_DAY

    return {
        "now_ms": now_ms,
        "today_ms": today_ms,
        "window_start_ms": window_start_ms,
        "window_end_ms": window_end_ms,
        "lines": sorted({b["lineId"] for b in blocks}),
        "blocks": blocks,
        "backlog": backlog,
        "kpis": kpis,
    }
