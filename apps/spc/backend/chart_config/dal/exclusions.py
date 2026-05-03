"""DAL for the spc_exclusions app-managed table."""

import json
from typing import Optional

from backend.utils.db import (
    insert_spc_exclusion_snapshot,
    run_sql_async,
    sql_param,
    tbl,
)


async def save_exclusion_snapshot(token: str, payload: dict) -> None:
    """Persist an immutable exclusion audit record."""
    await insert_spc_exclusion_snapshot(token, payload)


async def fetch_latest_exclusion_snapshot(
    token: str,
    material_id: str,
    mic_id: str,
    chart_type: str,
    operation_id: Optional[str],
    plant_id: Optional[str],
    stratify_all: bool,
    stratify_by: Optional[str],
    date_from: Optional[str],
    date_to: Optional[str],
) -> Optional[dict]:
    """Return the most recent exclusion snapshot for the given chart scope, or None."""
    params = [
        sql_param("material_id", material_id),
        sql_param("mic_id", mic_id),
        sql_param("operation_id", operation_id),
        sql_param("plant_id", plant_id),
        sql_param("stratify_all", stratify_all),
        sql_param("stratify_by", stratify_by),
        sql_param("chart_type", chart_type),
        sql_param("date_from", date_from),
        sql_param("date_to", date_to),
    ]

    sql = f"""
        SELECT
            event_id,
            material_id,
            mic_id,
            mic_name,
            operation_id,
            plant_id,
            stratify_all,
            stratify_by,
            chart_type,
            date_from,
            date_to,
            rule_set,
            justification,
            action,
            excluded_count,
            excluded_points_json,
            before_limits_json,
            after_limits_json,
            user_id,
            CAST(event_ts AS STRING) AS event_ts
        FROM {tbl('spc_exclusions')}
        WHERE material_id = :material_id
          AND mic_id = :mic_id
          AND chart_type = :chart_type
          AND operation_id <=> :operation_id
          AND plant_id <=> :plant_id
          AND COALESCE(stratify_all, false) = CAST(:stratify_all AS BOOLEAN)
          AND (
            stratify_by <=> :stratify_by
            OR (
              CAST(:stratify_all AS BOOLEAN) = true
              AND :stratify_by = 'plant_id'
              AND stratify_by IS NULL
            )
          )
          AND date_from <=> :date_from
          AND date_to <=> :date_to
        ORDER BY event_ts DESC
        LIMIT 1
    """

    rows = await run_sql_async(token, sql, params, endpoint_hint="spc.exclusions.get")
    if not rows:
        return None

    row = rows[0]
    row["excluded_count"] = int(float(row["excluded_count"])) if row.get("excluded_count") is not None else 0
    row["excluded_points"] = json.loads(row.pop("excluded_points_json") or "[]")
    row["before_limits"] = json.loads(row.pop("before_limits_json") or "null")
    row["after_limits"] = json.loads(row.pop("after_limits_json") or "null")
    return row
