"""DAL functions for writing to the ``spc_query_audit`` and ``spc_exclusions`` tables.

All writes bypass the read cache (``audit=False``) to avoid polluting cache
keys with INSERT statements and to prevent spurious cache invalidation.
"""

from __future__ import annotations

import json
import uuid
from typing import Optional

from spc_backend.utils.db import run_sql_async, sql_param, tbl


async def insert_spc_audit_event(
    token: str,
    *,
    event_type: str,
    detail: dict,
    sql_hash: Optional[str] = None,
    error_id: Optional[str] = None,
    request_path: Optional[str] = None,
) -> None:
    """Write a structured audit event row to ``spc_query_audit``.

    Intended for non-query events such as freshness errors and alarm triggers.
    The ``event_type`` and ``detail`` fields describe the event; SQL-query
    audit rows are written by :func:`insert_spc_query_audit` instead.

    Args:
        token: Databricks bearer token for the current user.
        event_type: Short machine-readable label (e.g. ``"freshness_error"``).
        detail: Arbitrary dict that will be serialised into the ``mic_id`` and
            related columns where the keys match, otherwise ignored.
        sql_hash: Optional statement hash from the triggering query.
        error_id: Optional UUID to correlate with logs/alerts.
        request_path: FastAPI request path that triggered the event.
    """
    from spc_backend.utils.db import _warehouse_id  # avoid circular at module level

    params = [
        sql_param("query_id", error_id or str(uuid.uuid4())),
        sql_param("endpoint", request_path or f"audit:{event_type}"),
        sql_param("material_id", detail.get("material_id")),
        sql_param("mic_id", detail.get("mic_id")),
        sql_param("plant_id", detail.get("plant_id")),
        sql_param("row_count", 0),
        sql_param("duration_ms", 0),
        sql_param("warehouse_id", _warehouse_id()),
    ]
    statement = f"""
        INSERT INTO {tbl('spc_query_audit')} (
            query_id, endpoint, material_id, mic_id, plant_id,
            row_count, duration_ms, warehouse_id, user_identity, executed_at
        )
        SELECT
            :query_id, :endpoint, :material_id, :mic_id, :plant_id,
            CAST(:row_count AS INT), CAST(:duration_ms AS BIGINT),
            :warehouse_id, CURRENT_USER(), CURRENT_TIMESTAMP()
    """
    await run_sql_async(token, statement, params, endpoint_hint="spc.audit-event", audit=False)


async def insert_spc_query_audit(
    token: str,
    *,
    endpoint: str,
    params: Optional[list[dict]],
    row_count: int,
    duration_ms: int,
) -> None:
    """Write one row to ``spc_query_audit`` recording a completed SQL query.

    Called by the SPC audit hook after every non-audit SELECT/WITH query.
    Skips the read cache and does not itself trigger another audit write.

    Args:
        token: Databricks bearer token for the current user.
        endpoint: Endpoint hint string (e.g. ``"spc.charts.chart-data"``).
        params: Original SQL parameters from the audited query, used to extract
            ``material_id``, ``mic_id``, and ``plant_id`` values.
        row_count: Number of rows returned by the audited query.
        duration_ms: Wall-clock milliseconds taken by the audited query.
    """
    from spc_backend.utils.db import _warehouse_id, _first_param_value  # avoid circular at module level

    insert_params = [
        sql_param("query_id", str(uuid.uuid4())),
        sql_param("endpoint", endpoint),
        sql_param("material_id", _first_param_value(params, "material_id")),
        sql_param("mic_id", _first_param_value(params, "mic_id", "mic_a_id", "mic_b_id")),
        sql_param("plant_id", _first_param_value(params, "plant_id")),
        sql_param("row_count", row_count),
        sql_param("duration_ms", duration_ms),
        sql_param("warehouse_id", _warehouse_id()),
    ]
    statement = f"""
        INSERT INTO {tbl('spc_query_audit')} (
            query_id, endpoint, material_id, mic_id, plant_id,
            row_count, duration_ms, warehouse_id, user_identity, executed_at
        )
        SELECT
            :query_id, :endpoint, :material_id, :mic_id, :plant_id,
            CAST(:row_count AS INT), CAST(:duration_ms AS BIGINT),
            :warehouse_id, CURRENT_USER(), CURRENT_TIMESTAMP()
    """
    await run_sql_async(token, statement, insert_params, endpoint_hint="spc.query-audit", audit=False)


async def insert_spc_exclusion_snapshot(token: str, payload: dict) -> None:
    """Write an exclusion decision snapshot row to ``spc_exclusions``.

    Captures the full context of a point-exclusion action so that auditors
    can reconstruct exactly which points were excluded, by whom, and why.

    Args:
        token: Databricks bearer token for the current user.
        payload: Dict with at minimum ``event_id``, ``material_id``, ``mic_id``,
            ``chart_type``, ``justification``, ``excluded_count``, and
            ``excluded_points`` keys.
    """
    params = [
        sql_param("event_id", payload["event_id"]),
        sql_param("material_id", payload["material_id"]),
        sql_param("mic_id", payload["mic_id"]),
        sql_param("mic_name", payload.get("mic_name")),
        sql_param("plant_id", payload.get("plant_id")),
        sql_param("stratify_all", payload.get("stratify_all", False)),
        sql_param("stratify_by", payload.get("stratify_by")),
        sql_param("chart_type", payload["chart_type"]),
        sql_param("date_from", payload.get("date_from")),
        sql_param("date_to", payload.get("date_to")),
        sql_param("rule_set", payload.get("rule_set")),
        sql_param("justification", payload["justification"]),
        sql_param("action", payload.get("action")),
        sql_param("excluded_count", payload["excluded_count"]),
        sql_param("excluded_points_json", json.dumps(payload["excluded_points"], separators=(",", ":"))),
        sql_param("before_limits_json", json.dumps(payload.get("before_limits"), separators=(",", ":"))),
        sql_param("after_limits_json", json.dumps(payload.get("after_limits"), separators=(",", ":"))),
    ]
    insert_sql = f"""
        INSERT INTO {tbl('spc_exclusions')} (
            event_id, material_id, mic_id, mic_name, plant_id,
            stratify_all, stratify_by, chart_type, date_from, date_to,
            rule_set, justification, action, excluded_count,
            excluded_points_json, before_limits_json, after_limits_json,
            user_id, event_ts
        )
        SELECT
            :event_id, :material_id, :mic_id, :mic_name, :plant_id,
            CAST(:stratify_all AS BOOLEAN), :stratify_by, :chart_type, :date_from, :date_to,
            :rule_set, :justification, :action, CAST(:excluded_count AS INT),
            :excluded_points_json, :before_limits_json, :after_limits_json,
            CURRENT_USER(), CURRENT_TIMESTAMP()
    """
    await run_sql_async(token, insert_sql, params, endpoint_hint="spc.exclusions.insert", audit=False)
