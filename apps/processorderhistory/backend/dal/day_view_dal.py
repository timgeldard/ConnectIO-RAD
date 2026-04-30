"""DAL for Day View — single-day production Gantt built from actual activity.

Runs 2 Databricks queries in parallel (asyncio.gather):
  1. blocks   — process orders with confirmation activity on the selected day.
                Block start/end = MIN(START_TIMESTAMP) / MAX(END_TIMESTAMP) from
                vw_gold_confirmation, giving true SAP confirmation window rather
                than ADP goods-movement timestamps.  Confirmed output qty is still
                derived from vw_gold_adp_movement MOVEMENT_TYPE='101'.
                Orders with no confirmation on the day are excluded via INNER JOIN.
  2. downtime — downtime records whose START_TIME falls on the selected day,
                joined to process orders for line attribution.

Both queries join to ``silver.silver_process_order`` to retrieve the 
``PROCESS_LINE`` column.

.. note::
   For now, silver lookups on PROCESS_LINE are to stay as this column has not 
   yet been promoted to the gold-layer view for this application.
   TODO: Move to gold-layer PRODUCTION_LINE once schema promotion is confirmed stable.

CREATED, RELEASED, CANCELLED, and DELETED orders are excluded to satisfy the
"no planned orders, no zero-activity orders" requirement.

Status → kind mapping:
  IN PROGRESS / Tulip Load In Progress → running
  COMPLETED / CLOSED                   → completed
  ON HOLD / anything else              → onhold
"""
import asyncio
from datetime import datetime, date as _date, timezone
from typing import Optional

from backend.db import run_sql_async, silver_tbl, sql_param, tbl

_MS_PER_DAY = 86_400_000
_MS_PER_SEC = 1_000

_STATUS_TO_KIND: dict[str, str] = {
    "IN PROGRESS": "running",
    "Tulip Load In Progress": "running",
    "COMPLETED": "completed",
    "CLOSED": "completed",
}
_DEFAULT_KIND = "onhold"

_EXCLUDED = "'CREATED', 'RELEASED', 'CANCELLED', 'DELETED'"


# ---------------------------------------------------------------------------
# Query coroutines
# ---------------------------------------------------------------------------

async def _q_blocks(token: str, day: str, plant_id: Optional[str]) -> list[dict]:
    """Process orders with confirmation activity on ``day``.

    Two CTEs run in a single statement:
      - day_conf    — MIN(START_TIMESTAMP) / MAX(END_TIMESTAMP) from
                      vw_gold_confirmation, giving the true SAP confirmation
                      window for each order.  INNER JOIN ensures orders with
                      no confirmation on the day are excluded.
      - receipt_qty — MOVEMENT_TYPE='101' goods-receipt qty from
                      vw_gold_adp_movement for confirmed output display.
    """
    plant_clause = "AND gpo.PLANT_ID = :plant_id" if plant_id else ""
    params: list[dict] = [sql_param("day", day)]
    if plant_id:
        params.append(sql_param("plant_id", plant_id))

    query = f"""
        WITH day_conf AS (
            SELECT
                PROCESS_ORDER_ID,
                CAST(UNIX_TIMESTAMP(MIN(START_TIMESTAMP)) * 1000 AS BIGINT) AS first_ms,
                CAST(UNIX_TIMESTAMP(MAX(END_TIMESTAMP))   * 1000 AS BIGINT) AS last_ms
            FROM {tbl('vw_gold_confirmation')}
            WHERE DATE(START_TIMESTAMP) = CAST(:day AS DATE)
            GROUP BY PROCESS_ORDER_ID
        ),
        receipt_qty AS (
            SELECT
                PROCESS_ORDER_ID,
                COALESCE(SUM(CASE
                    WHEN MOVEMENT_TYPE = '101' AND UPPER(TRIM(UOM)) = 'G'  THEN QUANTITY / 1000.0
                    WHEN MOVEMENT_TYPE = '101' AND UPPER(TRIM(UOM)) != 'EA' THEN QUANTITY
                    ELSE 0
                END), 0.0)                                                   AS confirmed_qty
            FROM {tbl('vw_gold_adp_movement')}
            WHERE DATE(DATE_TIME_OF_ENTRY) = CAST(:day AS DATE)
            GROUP BY PROCESS_ORDER_ID
        )
        SELECT
            gpo.PROCESS_ORDER_ID                                                AS process_order_id,
            COALESCE(spo.PROCESS_LINE, 'UNKNOWN')                              AS line_id,
            gpo.STATUS                                                          AS order_status,
            gpo.MATERIAL_ID                                                     AS material_id,
            COALESCE(m.MATERIAL_NAME, gpo.MATERIAL_ID)                         AS material_name,
            dc.first_ms,
            dc.last_ms,
            COALESCE(rq.confirmed_qty, 0.0)                                    AS confirmed_qty
        FROM day_conf dc
        JOIN {tbl('vw_gold_process_order')} gpo
            ON gpo.PROCESS_ORDER_ID = dc.PROCESS_ORDER_ID
        LEFT JOIN {silver_tbl('silver_process_order')} spo
            ON spo.PROCESS_ORDER_ID = dc.PROCESS_ORDER_ID
        LEFT JOIN {tbl('vw_gold_material')} m
            ON m.MATERIAL_ID = gpo.MATERIAL_ID
           AND m.LANGUAGE_ID = 'E'
        LEFT JOIN receipt_qty rq
            ON rq.PROCESS_ORDER_ID = dc.PROCESS_ORDER_ID
        WHERE gpo.STATUS NOT IN ({_EXCLUDED})
          {plant_clause}
        ORDER BY line_id, dc.first_ms
    """
    return await run_sql_async(token, query, params, endpoint_hint="poh.dayview.blocks")


async def _q_downtime(token: str, day: str, plant_id: Optional[str]) -> list[dict]:
    """Downtime records whose START_TIME falls on ``day``.

    Joined to process orders for production line attribution.  Applies the same
    STATUS exclusion as _q_blocks so only operational (not purely planned) orders
    contribute downtime.
    """
    plant_clause = "AND gpo.PLANT_ID = :plant_id" if plant_id else ""
    params: list[dict] = [sql_param("day", day)]
    if plant_id:
        params.append(sql_param("plant_id", plant_id))

    query = f"""
        SELECT
            dt.PROCESS_ORDER_ID                                                 AS process_order_id,
            CAST(UNIX_TIMESTAMP(dt.START_TIME) * 1000 AS BIGINT)               AS start_ms,
            dt.DURATION                                                         AS duration_s,
            dt.REASON_CODE                                                      AS reason_code,
            dt.ISSUE_TYPE                                                       AS issue_type,
            dt.ISSUE_TITLE                                                      AS issue_title,
            COALESCE(spo.PROCESS_LINE, 'UNKNOWN')                              AS line_id
        FROM {tbl('vw_gold_downtime_and_issues')} dt
        JOIN {tbl('vw_gold_process_order')} gpo
            ON gpo.PROCESS_ORDER_ID = dt.PROCESS_ORDER_ID
        LEFT JOIN {silver_tbl('silver_process_order')} spo
            ON spo.PROCESS_ORDER_ID = dt.PROCESS_ORDER_ID
        WHERE DATE(dt.START_TIME) = CAST(:day AS DATE)
          AND gpo.STATUS NOT IN ({_EXCLUDED})
          {plant_clause}
        ORDER BY dt.START_TIME
    """
    return await run_sql_async(token, query, params, endpoint_hint="poh.dayview.downtime")


# ---------------------------------------------------------------------------
# Coerce helpers
# ---------------------------------------------------------------------------

def _coerce_block(row: dict, day_start_ms: int, day_end_ms: int) -> dict:
    """Map a blocks row to the DayBlock interface; clamp times to the day boundary."""
    po_id = str(row.get("process_order_id") or "")
    line_id = str(row.get("line_id") or "UNKNOWN")
    status = str(row.get("order_status") or "")
    kind = _STATUS_TO_KIND.get(status, _DEFAULT_KIND)

    raw_start = row.get("first_ms")
    raw_end = row.get("last_ms")
    start_ms = max(day_start_ms, int(raw_start) if raw_start is not None else day_start_ms)
    end_ms = min(day_end_ms, int(raw_end) if raw_end is not None else day_end_ms)
    if end_ms <= start_ms:
        end_ms = min(day_end_ms, start_ms + _MS_PER_SEC)

    raw_planned = row.get("planned_qty")
    raw_confirmed = row.get("confirmed_qty")

    return {
        "id": f"{po_id}-{line_id}",
        "poId": po_id,
        "lineId": line_id,
        "start": start_ms,
        "end": end_ms,
        "kind": kind,
        "label": str(row.get("material_name") or po_id),
        "sublabel": str(row.get("material_id") or ""),
        "confirmedQty": float(raw_confirmed) if raw_confirmed is not None else 0.0,
        "plannedQty": float(raw_planned) if raw_planned is not None else 0.0,
        "uom": "KG",
    }


def _coerce_downtime(row: dict, day_start_ms: int, day_end_ms: int) -> dict:
    """Map a downtime row to the DayDowntime interface; clamp to the day boundary."""
    raw_start = row.get("start_ms")
    start_ms = max(day_start_ms, int(raw_start) if raw_start is not None else day_start_ms)
    raw_dur = row.get("duration_s")
    duration_s = float(raw_dur) if raw_dur is not None else 0.0
    end_ms = min(day_end_ms, start_ms + int(duration_s * _MS_PER_SEC))
    if end_ms <= start_ms:
        end_ms = min(day_end_ms, start_ms + _MS_PER_SEC)

    return {
        "poId": str(row.get("process_order_id") or ""),
        "lineId": str(row.get("line_id") or "UNKNOWN"),
        "start": start_ms,
        "end": end_ms,
        "reasonCode": row.get("reason_code") or None,
        "issueType": row.get("issue_type") or None,
        "issueTitle": row.get("issue_title") or None,
    }


# ---------------------------------------------------------------------------
# KPI builder
# ---------------------------------------------------------------------------

def _build_kpis(blocks: list[dict], downtime: list[dict]) -> dict:
    """Derive Day View KPIs from coerced block and downtime lists."""
    completed_count = sum(1 for b in blocks if b["kind"] == "completed")
    confirmed_qty = sum(b["confirmedQty"] for b in blocks)
    downtime_mins = sum((d["end"] - d["start"]) / 60_000 for d in downtime)
    return {
        "orderCount": len(blocks),
        "completedCount": completed_count,
        "confirmedQty": round(confirmed_qty, 3),
        "downtimeEvents": len(downtime),
        "downtimeMins": round(downtime_mins, 1),
    }


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def _parse_day(day: Optional[str]) -> str:
    """Return an ISO date string for ``day``, defaulting to today UTC."""
    if day:
        return day
    return _date.today().isoformat()


async def fetch_day_view(
    token: str,
    *,
    day: Optional[str] = None,
    plant_id: Optional[str] = None,
) -> dict:
    """Fetch Day View data via 2 parallel Databricks queries.

    ``day`` is an ISO date string (YYYY-MM-DD); defaults to today UTC.
    Returns Gantt blocks derived from ADP movement first/last timestamps,
    downtime overlays, KPIs, and day boundary milliseconds for the frontend
    time axis.

    Only orders with confirmation activity on ``day`` are included — planned
    (CREATED/RELEASED) and zero-activity orders are excluded automatically by
    the inner join to the day_conf CTE.
    """
    resolved_day = _parse_day(day)
    day_dt = _date.fromisoformat(resolved_day)

    day_start_ms = int(
        datetime(day_dt.year, day_dt.month, day_dt.day, tzinfo=timezone.utc).timestamp() * 1000
    )
    day_end_ms = day_start_ms + _MS_PER_DAY - 1

    block_rows, downtime_rows = await asyncio.gather(
        _q_blocks(token, resolved_day, plant_id),
        _q_downtime(token, resolved_day, plant_id),
    )

    blocks = [_coerce_block(r, day_start_ms, day_end_ms) for r in block_rows]
    downtime = [_coerce_downtime(r, day_start_ms, day_end_ms) for r in downtime_rows]
    kpis = _build_kpis(blocks, downtime)

    # Include lines from downtime records so lines with downtime but no orders still appear
    all_lines = sorted({b["lineId"] for b in blocks} | {d["lineId"] for d in downtime})

    return {
        "day": resolved_day,
        "day_start_ms": day_start_ms,
        "day_end_ms": day_end_ms,
        "lines": all_lines,
        "blocks": blocks,
        "downtime": downtime,
        "kpis": kpis,
    }
