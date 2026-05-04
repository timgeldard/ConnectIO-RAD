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
from backend.config.vessel_capacity import check_capacity
from backend.production_planning.domain.vessels import (
    AVAILABLE_KEYWORDS,
    DIRTY_KEYWORDS,
    IN_USE_KEYWORDS,
    classify_state as domain_classify_state,
    coerce_event_row as domain_coerce_event_row,
    coerce_int_ms as domain_coerce_int_ms,
    derive_planning_data as domain_derive_planning_data,
    state_reason as domain_state_reason,
)

_IN_USE_KEYWORDS = IN_USE_KEYWORDS
_DIRTY_KEYWORDS = DIRTY_KEYWORDS
_AVAILABLE_KEYWORDS = AVAILABLE_KEYWORDS

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
    return domain_classify_state(status_to, order_status)


# ---------------------------------------------------------------------------
# Coerce helpers
# ---------------------------------------------------------------------------

def _coerce_event_row(row: dict) -> dict:
    """Coerce Databricks string-serialised values in an equipment event row."""
    return domain_coerce_event_row(row)


def _coerce_int_ms(v: object) -> Optional[int]:
    """Safely coerce a nullable epoch-ms value to int."""
    return domain_coerce_int_ms(v)


# ---------------------------------------------------------------------------
# Derivation logic
# ---------------------------------------------------------------------------

def _state_reason(state: str, status_to, order_status, po_id) -> str:
    """Return a human-readable explanation for why this vessel state was assigned."""
    return domain_state_reason(state, status_to, order_status, po_id)


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
    return domain_derive_planning_data(
        latest_rows,
        events_rows,
        released_rows,
        capacity_check=check_capacity,
    )


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
        latest_coerced,
        events_coerced,
        released_rows,
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
