"""DAL — inspection lots, lot detail, location MICs, and location summary lots."""

from backend.utils.db import run_sql_async, sql_param
from backend.utils.em_config import (
    INSP_TYPES_SQL,
    LOT_TBL,
    POINT_TBL,
    RESULT_TBL,
)


async def fetch_lots(
    token: str,
    plant_id: str,
    func_loc_id: str,
    date_from: str,
) -> list[dict]:
    """Return inspection lots for a functional location from date_from onward."""
    params = [
        sql_param("plant_id",    plant_id),
        sql_param("func_loc_id", func_loc_id),
        sql_param("date_from",   date_from),
    ]
    sql = f"""
        SELECT
            lot.INSPECTION_LOT_ID    AS lot_id,
            ip.FUNCTIONAL_LOCATION   AS func_loc_id,
            lot.CREATED_DATE         AS inspection_start_date,
            lot.INSPECTION_END_DATE  AS inspection_end_date,
            MAX(CASE r.INSPECTION_RESULT_VALUATION
                WHEN 'R' THEN 'R' WHEN 'W' THEN 'W' WHEN 'A' THEN 'A' ELSE NULL END) AS valuation
        FROM {LOT_TBL} lot
        JOIN {POINT_TBL} ip ON lot.INSPECTION_LOT_ID = ip.INSPECTION_LOT_ID
        LEFT JOIN {RESULT_TBL} r
            ON ip.INSPECTION_LOT_ID = r.INSPECTION_LOT_ID
           AND ip.OPERATION_ID      = r.OPERATION_ID
           AND ip.SAMPLE_ID         = r.SAMPLE_ID
        WHERE lot.PLANT_ID             = :plant_id
          AND lot.INSPECTION_TYPE   IN {INSP_TYPES_SQL}
          AND ip.FUNCTIONAL_LOCATION   = :func_loc_id
          AND lot.CREATED_DATE        >= :date_from
        GROUP BY 1, 2, 3, 4
        ORDER BY lot.CREATED_DATE DESC
        LIMIT 200
    """
    return await run_sql_async(token, sql, params)


async def fetch_lot_detail(token: str, lot_id: str, plant_id: str) -> list[dict]:
    """Return individual MIC results for a specific inspection lot."""
    params = [sql_param("lot_id", lot_id), sql_param("plant_id", plant_id)]
    sql = f"""
        SELECT
            r.INSPECTION_LOT_ID           AS lot_id,
            r.MIC_ID                      AS mic_id,
            UPPER(TRIM(r.MIC_NAME))       AS mic_name,
            r.QUANTITATIVE_RESULT         AS result_value,
            r.INSPECTION_RESULT_VALUATION AS valuation,
            r.UPPER_TOLERANCE             AS upper_limit,
            r.LOWER_TOLERANCE             AS lower_limit
        FROM {RESULT_TBL} r
        WHERE r.INSPECTION_LOT_ID = :lot_id
          AND r.PLANT_ID          = :plant_id
        ORDER BY mic_name, r.SAMPLE_ID
    """
    return await run_sql_async(token, sql, params)


async def fetch_location_mics(
    token: str,
    plant_id: str,
    func_loc_id: str,
    date_from: str,
) -> list[dict]:
    """Return distinct normalised MIC names seen at a location since date_from."""
    params = [
        sql_param("plant_id",    plant_id),
        sql_param("func_loc_id", func_loc_id),
        sql_param("date_from",   date_from),
    ]
    sql = f"""
        SELECT DISTINCT UPPER(TRIM(r.MIC_NAME)) AS mic_name
        FROM {LOT_TBL} lot
        JOIN {POINT_TBL} ip ON lot.INSPECTION_LOT_ID = ip.INSPECTION_LOT_ID
        JOIN {RESULT_TBL} r
            ON ip.INSPECTION_LOT_ID = r.INSPECTION_LOT_ID
           AND ip.OPERATION_ID      = r.OPERATION_ID
           AND ip.SAMPLE_ID         = r.SAMPLE_ID
        WHERE lot.PLANT_ID             = :plant_id
          AND lot.INSPECTION_TYPE IN {INSP_TYPES_SQL}
          AND ip.FUNCTIONAL_LOCATION   = :func_loc_id
          AND lot.CREATED_DATE        >= :date_from
    """
    return await run_sql_async(token, sql, params)


async def fetch_location_recent_lots(
    token: str,
    plant_id: str,
    func_loc_id: str,
    date_from: str,
) -> list[dict]:
    """Return the 5 most recent lots for a location since date_from."""
    params = [
        sql_param("plant_id",    plant_id),
        sql_param("func_loc_id", func_loc_id),
        sql_param("date_from",   date_from),
    ]
    sql = f"""
        SELECT
            lot.INSPECTION_LOT_ID  AS lot_id,
            ip.FUNCTIONAL_LOCATION AS func_loc_id,
            lot.CREATED_DATE       AS inspection_start_date,
            lot.INSPECTION_END_DATE AS inspection_end_date,
            MAX(CASE r.INSPECTION_RESULT_VALUATION
                WHEN 'R' THEN 'R' WHEN 'W' THEN 'W' WHEN 'A' THEN 'A' ELSE NULL END) AS valuation
        FROM {LOT_TBL} lot
        JOIN {POINT_TBL} ip ON lot.INSPECTION_LOT_ID = ip.INSPECTION_LOT_ID
        LEFT JOIN {RESULT_TBL} r
            ON ip.INSPECTION_LOT_ID = r.INSPECTION_LOT_ID
           AND ip.OPERATION_ID      = r.OPERATION_ID
           AND ip.SAMPLE_ID         = r.SAMPLE_ID
        WHERE lot.PLANT_ID             = :plant_id
          AND lot.INSPECTION_TYPE IN {INSP_TYPES_SQL}
          AND ip.FUNCTIONAL_LOCATION   = :func_loc_id
          AND lot.CREATED_DATE        >= :date_from
        GROUP BY 1, 2, 3, 4
        ORDER BY 3 DESC
        LIMIT 5
    """
    return await run_sql_async(token, sql, params)
