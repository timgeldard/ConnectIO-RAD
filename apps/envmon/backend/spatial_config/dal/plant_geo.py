"""DAL — plant geographic coordinates: reads and admin writes to em_plant_geo."""

from backend.utils.db import run_sql_async, sql_param
from backend.utils.em_config import PLANT_GEO_TBL


async def fetch_all_plant_geo(token: str) -> list[dict]:
    """Return all plant lat/lon entries ordered by plant_id."""
    sql = f"SELECT plant_id, lat, lon, updated_at, updated_by FROM {PLANT_GEO_TBL} ORDER BY plant_id"
    return await run_sql_async(token, sql)


async def upsert_plant_geo(token: str, plant_id: str, lat: float, lon: float) -> None:
    """Upsert a plant's lat/lon into em_plant_geo."""
    params = [
        sql_param("plant_id", plant_id),
        sql_param("lat",      str(lat)),
        sql_param("lon",      str(lon)),
    ]
    sql = f"""
        MERGE INTO {PLANT_GEO_TBL} AS t
        USING (SELECT :plant_id AS plant_id, CAST(:lat AS DOUBLE) AS lat, CAST(:lon AS DOUBLE) AS lon) AS s
        ON t.plant_id = s.plant_id
        WHEN MATCHED THEN
            UPDATE SET lat = s.lat, lon = s.lon, updated_at = CURRENT_TIMESTAMP()
        WHEN NOT MATCHED THEN
            INSERT (plant_id, lat, lon, updated_at)
            VALUES (s.plant_id, s.lat, s.lon, CURRENT_TIMESTAMP())
    """
    await run_sql_async(token, sql, params)
