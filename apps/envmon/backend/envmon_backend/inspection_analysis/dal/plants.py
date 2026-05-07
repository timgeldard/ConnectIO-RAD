"""DAL — plant discovery, metadata, KPIs, and floor counts."""

import logging
from typing import Any

from envmon_backend.utils.db import run_sql_async, sql_param
from envmon_backend.utils.em_config import (
    FLOOR_TBL,
    INSP_TYPES_SQL,
    LOT_TBL,
    PLANT_GEO_TBL,
    PLANT_TBL,
    POINT_TBL,
    RESULT_TBL,
)

logger = logging.getLogger(__name__)


def _row_get(row: dict[str, Any], *keys: str, default: Any = None) -> Any:
    """Case-insensitive dict lookup with fallback keys."""
    for key in keys:
        if key in row:
            return row[key]
    lowered = {str(k).lower(): v for k, v in row.items()}
    for key in keys:
        if key.lower() in lowered:
            return lowered[key.lower()]
    return default


async def fetch_active_plant_ids(token: str) -> list[str]:
    """Return EM-relevant plant codes: have type-14/Z14 lots, not 'DNU%' named."""
    sql = f"""
        SELECT DISTINCT lot.PLANT_ID
        FROM {LOT_TBL} lot
        LEFT JOIN {PLANT_TBL} p ON p.PLANT_ID = lot.PLANT_ID
        WHERE lot.INSPECTION_TYPE IN {INSP_TYPES_SQL}
          AND lot.PLANT_ID IS NOT NULL
          AND (p.PLANT_NAME IS NULL OR UPPER(p.PLANT_NAME) NOT LIKE 'DNU%')
        ORDER BY lot.PLANT_ID
    """
    rows = await run_sql_async(token, sql)
    return [
        str(plant_id)
        for r in rows
        if (plant_id := _row_get(r, "PLANT_ID", "plant_id"))
    ]


def _plant_id_in_clause(plant_ids: list[str]) -> tuple[str, list[dict]]:
    """Build a parameterised IN clause for a list of plant IDs.

    The repo rule is "all user-supplied values via :name parameters" — even
    though plant IDs are typed list[str] before reaching here, building the
    IN clause via f-string concatenation normalises the unsafe pattern in a
    repo that explicitly forbids it. This helper expands one named parameter
    per ID so the same ``run_sql_async`` path enforces type-correct binding.

    Args:
        plant_ids: List of plant ID strings to match.

    Returns:
        Two-tuple of ``(in_clause, params)``. ``in_clause`` is the SQL
        fragment ``"(:p0, :p1, ...)"`` for inlining after ``IN``;
        ``params`` is the matching named-parameter list. Returns
        ``("(NULL)", [])`` for an empty input so the predicate produces
        no rows rather than a syntax error.
    """
    if not plant_ids:
        return "(NULL)", []
    placeholders = ", ".join(f":p{i}" for i in range(len(plant_ids)))
    params = [sql_param(f"p{i}", pid) for i, pid in enumerate(plant_ids)]
    return f"({placeholders})", params


async def fetch_plant_geo(token: str, plant_ids: list[str]) -> list[dict]:
    """Return lat/lon rows from em_plant_geo for the given plant IDs.

    Args:
        token: Forwarded Databricks access token.
        plant_ids: List of plant IDs to look up. Empty list returns no rows.

    Returns:
        List of ``{plant_id, lat, lon}`` rows from ``em_plant_geo``.
    """
    in_clause, params = _plant_id_in_clause(plant_ids)
    sql = f"SELECT plant_id, lat, lon FROM {PLANT_GEO_TBL} WHERE plant_id IN {in_clause}"
    return await run_sql_async(token, sql, params)


async def fetch_plant_metadata(token: str, plant_ids: list[str]) -> list[dict]:
    """Return plant name, country, city rows from gold_plant for the given IDs.

    Args:
        token: Forwarded Databricks access token.
        plant_ids: List of plant IDs to look up. Empty list returns no rows.

    Returns:
        List of ``{PLANT_ID, PLANT_NAME, COUNTRY_ID, CITY}`` rows.
    """
    in_clause, params = _plant_id_in_clause(plant_ids)
    sql = f"""
        SELECT PLANT_ID, PLANT_NAME, COUNTRY_ID, CITY
        FROM {PLANT_TBL}
        WHERE PLANT_ID IN {in_clause}
    """
    return await run_sql_async(token, sql, params)


async def fetch_plant_kpis(token: str, plant_id: str, days: int) -> list[dict]:
    """Return a single-row KPI summary for one plant over the given day window."""
    params = [sql_param("plant_id", plant_id)]
    sql = f"""
        WITH base AS (
            SELECT
                ip.FUNCTIONAL_LOCATION          AS func_loc_id,
                r.INSPECTION_RESULT_VALUATION   AS valuation,
                lot.INSPECTION_LOT_ID           AS lot_id
            FROM {LOT_TBL} lot
            JOIN {POINT_TBL} ip
                ON lot.INSPECTION_LOT_ID = ip.INSPECTION_LOT_ID
            LEFT JOIN {RESULT_TBL} r
                ON ip.INSPECTION_LOT_ID = r.INSPECTION_LOT_ID
               AND ip.OPERATION_ID      = r.OPERATION_ID
               AND ip.SAMPLE_ID         = r.SAMPLE_ID
            WHERE lot.PLANT_ID = :plant_id
              AND lot.INSPECTION_TYPE IN {INSP_TYPES_SQL}
              AND ip.FUNCTIONAL_LOCATION IS NOT NULL
              AND lot.CREATED_DATE >= DATEADD(DAY, -{days}, CURRENT_DATE)
        ),
        loc_status AS (
            SELECT
                func_loc_id,
                MAX(CASE WHEN valuation IN ('R','REJ','REJECT') THEN 1 ELSE 0 END) AS is_fail,
                MAX(CASE WHEN valuation IN ('W','WARN')          THEN 1 ELSE 0 END) AS is_warn,
                MAX(CASE WHEN valuation IS NULL                  THEN 1 ELSE 0 END) AS is_pending,
                COUNT(DISTINCT lot_id) AS lot_count
            FROM base
            GROUP BY func_loc_id
        )
        SELECT
            COUNT(*)                                                                    AS total_locs,
            SUM(CASE WHEN is_fail = 1 THEN 1 ELSE 0 END)                              AS active_fails,
            SUM(CASE WHEN is_warn = 1 THEN 1 ELSE 0 END)                              AS warnings,
            SUM(CASE WHEN is_pending = 1 THEN 1 ELSE 0 END)                           AS pending,
            SUM(CASE WHEN is_fail = 0 AND is_warn = 0 AND is_pending = 0 THEN 1 ELSE 0 END) AS pass_locs,
            SUM(lot_count)                                                              AS lots_tested
        FROM loc_status
    """
    return await run_sql_async(token, sql, params)


async def count_plant_floors(token: str, plant_id: str) -> list[dict]:
    """Return a single-row count of floors for a plant."""
    params = [sql_param("plant_id", plant_id)]
    sql = f"SELECT COUNT(*) AS n FROM {FLOOR_TBL} WHERE plant_id = :plant_id"
    return await run_sql_async(token, sql, params)
