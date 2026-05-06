"""DAL — heatmap source rows: coordinates joined with inspection results."""

from envmon_backend.utils.db import run_sql_async, sql_param
from envmon_backend.utils.em_config import (
    COORD_TBL,
    INSP_TYPES_SQL,
    LOT_TBL,
    POINT_TBL,
    RESULT_TBL,
)


async def fetch_heatmap_rows(
    token: str,
    plant_id: str,
    floor_id: str,
    date_from: str,
    date_to: str,
    mics: list[str] | None,
) -> list[dict]:
    """Return result rows joined to mapped coordinates for a floor within a date range."""
    params = [
        sql_param("plant_id",  plant_id),
        sql_param("floor_id",  floor_id),
        sql_param("date_from", date_from),
        sql_param("date_to",   date_to),
    ]

    mic_filter = ""
    if mics:
        norm_mics = [m.upper().strip() for m in mics]
        for idx, m in enumerate(norm_mics):
            params.append(sql_param(f"mic_{idx}", m))
        placeholders = ", ".join(f":mic_{idx}" for idx in range(len(norm_mics)))
        mic_filter = f"AND UPPER(TRIM(r.MIC_NAME)) IN ({placeholders})"

    sql = f"""
        SELECT
            c.func_loc_id,
            c.floor_id,
            c.x_pos,
            c.y_pos,
            r.inspection_lot_id AS lot_id,
            r.valuation,
            r.mic_name,
            r.quantitative_result,
            TO_DATE(lot.CREATED_DATE) AS lot_date
        FROM {COORD_TBL} c
        JOIN {POINT_TBL} p ON c.func_loc_id = p.FUNCTIONAL_LOCATION
        LEFT JOIN {LOT_TBL} lot ON p.INSPECTION_LOT_ID = lot.INSPECTION_LOT_ID
            AND lot.PLANT_ID = :plant_id
            AND lot.INSPECTION_TYPE IN {INSP_TYPES_SQL}
        LEFT JOIN {RESULT_TBL} r ON p.INSPECTION_LOT_ID = r.INSPECTION_LOT_ID
            AND p.OPERATION_ID = r.OPERATION_ID
            AND p.SAMPLE_ID = r.SAMPLE_ID
        WHERE c.plant_id = :plant_id
          AND c.floor_id = :floor_id
          AND (lot.CREATED_DATE IS NULL OR (lot.CREATED_DATE >= :date_from AND lot.CREATED_DATE <= :date_to))
          {mic_filter}
        ORDER BY c.func_loc_id, lot.CREATED_DATE ASC
    """
    return await run_sql_async(token, sql, params)
