"""DAL — MIC time-series trends and MIC name discovery."""

from backend.utils.db import run_sql_async, sql_param
from backend.utils.em_config import (
    INSP_TYPES_SQL,
    LOT_TBL,
    POINT_TBL,
    RESULT_TBL,
)


async def fetch_mics(
    token: str,
    plant_id: str,
    func_loc_id: str | None,
    date_from: str,
) -> list[dict]:
    """Return distinct normalised MIC names for a plant, optionally scoped to one location."""
    params = [sql_param("plant_id", plant_id)]

    if func_loc_id:
        params.append(sql_param("func_loc_id", func_loc_id))
        where_extra = "AND ip.FUNCTIONAL_LOCATION = :func_loc_id"
    else:
        params.append(sql_param("date_from", date_from))
        where_extra = "AND lot.CREATED_DATE >= :date_from"

    sql = f"""
        SELECT DISTINCT UPPER(TRIM(r.MIC_NAME)) AS mic_name
        FROM {LOT_TBL} lot
        JOIN {POINT_TBL} ip
            ON lot.INSPECTION_LOT_ID = ip.INSPECTION_LOT_ID
        JOIN {RESULT_TBL} r
            ON ip.INSPECTION_LOT_ID = r.INSPECTION_LOT_ID
           AND ip.OPERATION_ID      = r.OPERATION_ID
           AND ip.SAMPLE_ID         = r.SAMPLE_ID
        WHERE lot.PLANT_ID          = :plant_id
          AND lot.INSPECTION_TYPE IN {INSP_TYPES_SQL}
          {where_extra}
          AND r.MIC_NAME IS NOT NULL
        ORDER BY mic_name
    """
    return await run_sql_async(token, sql, params)


async def fetch_trends(
    token: str,
    plant_id: str,
    func_loc_id: str,
    mic_name: str,
    date_from: str,
) -> list[dict]:
    """Return chronological MIC result rows for one location and MIC from date_from onward."""
    params = [
        sql_param("plant_id",    plant_id),
        sql_param("func_loc_id", func_loc_id),
        sql_param("mic_name",    mic_name),
        sql_param("date_from",   date_from),
    ]
    sql = f"""
        SELECT
            lot.CREATED_DATE              AS inspection_date,
            UPPER(TRIM(r.MIC_NAME))       AS mic_name,
            r.QUANTITATIVE_RESULT         AS result_value,
            r.INSPECTION_RESULT_VALUATION AS valuation,
            r.UPPER_TOLERANCE             AS upper_limit,
            r.LOWER_TOLERANCE             AS lower_limit
        FROM {LOT_TBL} lot
        JOIN {POINT_TBL} ip
            ON lot.INSPECTION_LOT_ID = ip.INSPECTION_LOT_ID
        JOIN {RESULT_TBL} r
            ON ip.INSPECTION_LOT_ID = r.INSPECTION_LOT_ID
           AND ip.OPERATION_ID      = r.OPERATION_ID
           AND ip.SAMPLE_ID         = r.SAMPLE_ID
        WHERE lot.PLANT_ID             = :plant_id
          AND lot.INSPECTION_TYPE   IN {INSP_TYPES_SQL}
          AND ip.FUNCTIONAL_LOCATION   = :func_loc_id
          AND UPPER(TRIM(r.MIC_NAME))  = :mic_name
          AND lot.CREATED_DATE        >= :date_from
        ORDER BY lot.CREATED_DATE ASC
    """
    return await run_sql_async(token, sql, params)
