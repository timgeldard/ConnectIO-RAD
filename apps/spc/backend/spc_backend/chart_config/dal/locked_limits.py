"""DAL for the spc_locked_limits app-managed table."""

from typing import Optional

from spc_backend.chart_config.domain.locked_limits import LockedLimits
from spc_backend.utils.db import run_sql_async, sql_param, tbl


async def save_locked_limits(
    token: str,
    limits: LockedLimits,
) -> dict:
    """MERGE-upsert a locked-limits record for a chart scope.

    Args:
        token: Databricks access token forwarded from the proxy header.
        limits: Validated locked-limits domain value object.

    Returns:
        Dict indicating that the record was saved.

    Raises:
        RuntimeError: Propagates SQL runtime failures.
    """
    params = [
        sql_param("material_id", limits.material_id),
        sql_param("mic_id", limits.mic_id),
        sql_param("chart_type", limits.chart_type),
        sql_param("cl", limits.cl),
        sql_param("ucl", limits.ucl),
        sql_param("lcl", limits.lcl),
        sql_param("ucl_r", limits.ucl_r),
        sql_param("lcl_r", limits.lcl_r),
        sql_param("sigma_within", limits.sigma_within),
        sql_param("baseline_from", limits.baseline_from),
        sql_param("baseline_to", limits.baseline_to),
        sql_param("unified_mic_key", limits.unified_mic_key),
        sql_param("mic_origin", limits.mic_origin),
        sql_param("spec_signature", limits.spec_signature),
        sql_param("locking_note", limits.locking_note),
    ]
    if limits.plant_id:
        source_plant_expr = "CAST(:plant_id AS STRING)"
        plant_on_clause = "COALESCE(t.plant_id, '') = COALESCE(s.plant_id, '')"
        params.append(sql_param("plant_id", limits.plant_id))
    else:
        source_plant_expr = "NULL"
        plant_on_clause = "t.plant_id IS NULL AND s.plant_id IS NULL"
    if limits.operation_id:
        source_operation_id_expr = "CAST(:operation_id AS STRING)"
        operation_id_on_clause = "COALESCE(t.operation_id, '') = COALESCE(s.operation_id, '')"
        params.append(sql_param("operation_id", limits.operation_id))
    else:
        source_operation_id_expr = "NULL"
        operation_id_on_clause = "t.operation_id IS NULL AND s.operation_id IS NULL"
    if limits.unified_mic_key:
        mic_identity_on_clause = (
            "(COALESCE(t.unified_mic_key, '') = COALESCE(s.unified_mic_key, '') "
            "OR (t.unified_mic_key IS NULL AND t.mic_id = s.mic_id))"
        )
    else:
        mic_identity_on_clause = "t.mic_id = s.mic_id"
    merge_sql = f"""
        MERGE INTO {tbl('spc_locked_limits')} AS t
        USING (SELECT
            :material_id      AS material_id,
            :mic_id           AS mic_id,
            {source_plant_expr} AS plant_id,
            {source_operation_id_expr} AS operation_id,
            :chart_type       AS chart_type,
            :cl               AS cl,
            :ucl              AS ucl,
            :lcl              AS lcl,
            :ucl_r            AS ucl_r,
            :lcl_r            AS lcl_r,
            :sigma_within     AS sigma_within,
            :baseline_from    AS baseline_from,
            :baseline_to      AS baseline_to,
            :unified_mic_key  AS unified_mic_key,
            :mic_origin       AS mic_origin,
            :spec_signature   AS spec_signature,
            :locking_note     AS locking_note,
            CURRENT_USER()    AS locked_by,
            CURRENT_TIMESTAMP() AS locked_at
        ) AS s
        ON t.material_id = s.material_id
           AND t.chart_type = s.chart_type
           AND {mic_identity_on_clause}
           AND {plant_on_clause}
           AND {operation_id_on_clause}
        WHEN MATCHED THEN UPDATE SET
            t.cl              = s.cl,
            t.ucl             = s.ucl,
            t.lcl             = s.lcl,
            t.ucl_r           = s.ucl_r,
            t.lcl_r           = s.lcl_r,
            t.sigma_within    = s.sigma_within,
            t.baseline_from   = s.baseline_from,
            t.baseline_to     = s.baseline_to,
            t.unified_mic_key = s.unified_mic_key,
            t.mic_origin      = s.mic_origin,
            t.spec_signature  = s.spec_signature,
            t.locking_note    = s.locking_note,
            t.locked_by       = s.locked_by,
            t.locked_at       = s.locked_at
        WHEN NOT MATCHED THEN INSERT (
            material_id, mic_id, plant_id, operation_id, chart_type,
            cl, ucl, lcl, ucl_r, lcl_r, sigma_within,
            baseline_from, baseline_to,
            unified_mic_key, mic_origin, spec_signature, locking_note,
            locked_by, locked_at
        ) VALUES (
            s.material_id, s.mic_id, s.plant_id, s.operation_id, s.chart_type,
            s.cl, s.ucl, s.lcl, s.ucl_r, s.lcl_r, s.sigma_within,
            s.baseline_from, s.baseline_to,
            s.unified_mic_key, s.mic_origin, s.spec_signature, s.locking_note,
            s.locked_by, s.locked_at
        )
    """
    await run_sql_async(token, merge_sql, params, endpoint_hint="spc.charts.lock-limits")
    return {"saved": True}


async def fetch_locked_limits(
    token: str,
    material_id: str,
    mic_id: str,
    plant_id: Optional[str],
    chart_type: str,
    operation_id: Optional[str] = None,
    unified_mic_key: Optional[str] = None,
) -> Optional[dict]:
    """Return the most recently locked limits for the given scope, or None."""
    params = [
        sql_param("material_id", material_id),
        sql_param("chart_type", chart_type),
    ]
    if unified_mic_key:
        mic_scope_filter = "AND (unified_mic_key = :unified_mic_key OR mic_id = :mic_id)"
        mic_scope_order = "CASE WHEN unified_mic_key = :unified_mic_key THEN 0 ELSE 1 END,"
        params.append(sql_param("unified_mic_key", unified_mic_key))
        params.append(sql_param("mic_id", mic_id))
    else:
        mic_scope_filter = "AND mic_id = :mic_id"
        mic_scope_order = ""
        params.append(sql_param("mic_id", mic_id))
    if plant_id:
        plant_filter = "AND plant_id = :plant_id"
        params.append(sql_param("plant_id", plant_id))
    else:
        plant_filter = "AND plant_id IS NULL"
    if operation_id:
        operation_id_filter = "AND operation_id = :operation_id"
        params.append(sql_param("operation_id", operation_id))
    else:
        operation_id_filter = "AND operation_id IS NULL"
    query = f"""
        SELECT material_id, mic_id, plant_id, operation_id, chart_type,
               cl, ucl, lcl, ucl_r, lcl_r, sigma_within,
               baseline_from, baseline_to,
               unified_mic_key, mic_origin, spec_signature, locking_note,
               locked_by, locked_at
        FROM {tbl('spc_locked_limits')}
        WHERE material_id = :material_id
          AND chart_type = :chart_type
          {mic_scope_filter}
          {plant_filter}
          {operation_id_filter}
        ORDER BY {mic_scope_order} locked_at DESC
        LIMIT 1
    """
    rows = await run_sql_async(token, query, params, endpoint_hint="spc.charts.locked-limits")
    if not rows:
        return None
    row = rows[0]
    for field_name in ("cl", "ucl", "lcl", "ucl_r", "lcl_r", "sigma_within"):
        value = row.get(field_name)
        row[field_name] = float(value) if value is not None else None
    if row.get("locked_at") is not None:
        row["locked_at"] = str(row["locked_at"])
    return row


async def delete_locked_limits(
    token: str,
    material_id: str,
    mic_id: str,
    plant_id: Optional[str],
    chart_type: str,
    operation_id: Optional[str] = None,
    unified_mic_key: Optional[str] = None,
) -> dict:
    """Delete the locked-limits record for the given scope."""
    params = [
        sql_param("material_id", material_id),
        sql_param("chart_type", chart_type),
    ]
    if unified_mic_key:
        mic_scope_filter = "AND (unified_mic_key = :unified_mic_key OR mic_id = :mic_id)"
        params.append(sql_param("unified_mic_key", unified_mic_key))
        params.append(sql_param("mic_id", mic_id))
    else:
        mic_scope_filter = "AND mic_id = :mic_id"
        params.append(sql_param("mic_id", mic_id))
    if plant_id:
        plant_filter = "AND plant_id = :plant_id"
        params.append(sql_param("plant_id", plant_id))
    else:
        plant_filter = "AND plant_id IS NULL"
    if operation_id:
        operation_id_filter = "AND operation_id = :operation_id"
        params.append(sql_param("operation_id", operation_id))
    else:
        operation_id_filter = "AND operation_id IS NULL"
    query = f"""
        DELETE FROM {tbl('spc_locked_limits')}
        WHERE material_id = :material_id
          AND chart_type = :chart_type
          {mic_scope_filter}
          {plant_filter}
          {operation_id_filter}
    """
    await run_sql_async(token, query, params, endpoint_hint="spc.charts.delete-locked-limits")
    return {"deleted": True}
