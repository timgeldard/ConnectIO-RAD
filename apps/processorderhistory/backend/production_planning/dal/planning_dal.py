"""DAL for production planning board — scheduled order Gantt data.

Runs 2 Databricks queries in parallel (asyncio.gather):
  1. blocks  — silver process orders with SCHEDULED_START in the ±7-day window,
               enriched with gold order status and material name
  2. backlog — released/unstarted process orders from the gold view (up to 30),
               representing work not yet appearing on the Gantt

Block start times come from ``silver_process_order.SCHEDULED_START``.

.. note::
   For now, silver lookups on PROCESS_LINE and SCHEDULED_START are to stay as 
   these columns have not yet been promoted to the gold-layer view for this 
   application.
   TODO: Move to gold-layer view once schema promotion is confirmed stable.
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
from backend.production_planning.domain.planning import (
    DEFAULT_BLOCK_HRS,
    MS_PER_DAY,
    build_kpis as domain_build_kpis,
    coerce_backlog as domain_coerce_backlog,
    coerce_block as domain_coerce_block,
)

_MS_PER_DAY = MS_PER_DAY
_DEFAULT_BLOCK_HRS = DEFAULT_BLOCK_HRS
_WINDOW_DAYS_BACK = 2
_WINDOW_DAYS_FORWARD = 5


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
    return domain_coerce_block(row, now_ms)


def _coerce_backlog(row: dict, due_ms: int) -> dict:
    """Map a backlog row to the backlog card interface."""
    return domain_coerce_backlog(row, due_ms)


# ---------------------------------------------------------------------------
# KPI builder
# ---------------------------------------------------------------------------

def _build_kpis(blocks: list[dict], backlog: list[dict], now_ms: int) -> dict:
    """Derive planning KPIs from block and backlog data.

    Capacity-dependent metrics (utilization, on-time %) return 0 until a
    capacity master or schedule adherence metric view is wired in.
    """
    return domain_build_kpis(blocks, backlog, now_ms)


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
