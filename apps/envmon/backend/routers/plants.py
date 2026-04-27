"""
GET /api/em/plants  — discover plants that have type-14/Z14 inspection lots,
enriched with metadata from gold_plant and real lat/lon from the internal
em_plant_geo config table (editable via the admin screen).
No env-var config required — the list is fully DB-driven.
"""

import asyncio
import logging
from typing import Any, Optional

from fastapi import APIRouter, Header, Query

from backend.schemas.em import PlantInfo, PlantKpis
from backend.utils.db import resolve_token, run_sql_async, sql_param
from backend.utils.em_config import (
    FLOOR_TBL,
    INSP_TYPES_SQL,
    LOT_TBL,
    PLANT_GEO_TBL,
    PLANT_TBL,
    POINT_TBL,
    RESULT_TBL,
)

router = APIRouter()


async def _fetch_active_plant_ids(token: str) -> list[str]:
    """Return distinct plant codes that have at least one type-14/Z14 lot."""
    sql = f"""
        SELECT DISTINCT PLANT_ID
        FROM {LOT_TBL}
        WHERE INSPECTION_TYPE IN {INSP_TYPES_SQL}
          AND PLANT_ID IS NOT NULL
        ORDER BY PLANT_ID
    """
    rows = await run_sql_async(token, sql)
    return [
        str(plant_id)
        for r in rows
        if (plant_id := _row_get(r, "PLANT_ID", "plant_id"))
    ]


def _row_get(row: dict[str, Any], *keys: str, default: Any = None) -> Any:
    for key in keys:
        if key in row:
            return row[key]
    lowered = {str(k).lower(): v for k, v in row.items()}
    for key in keys:
        if key.lower() in lowered:
            return lowered[key.lower()]
    return default


async def _fetch_plant_metadata(token: str, plant_ids: list[str]) -> dict[str, dict]:
    """Fetch plant metadata and coordinates without letting metadata failures hide map pins."""
    if not plant_ids:
        return {}

    id_list = ", ".join(f"'{pid}'" for pid in plant_ids)
    metadata: dict[str, dict] = {
        pid: {
            "plant_name": pid,
            "country": "",
            "region": "EMEA",
            "city": "",
            "lat": 0.0,
            "lon": 0.0,
        }
        for pid in plant_ids
    }

    geo_sql = f"""
        SELECT plant_id, lat, lon
        FROM {PLANT_GEO_TBL}
        WHERE plant_id IN ({id_list})
    """
    try:
        rows = await run_sql_async(token, geo_sql)
    except Exception as exc:
        logging.warning(f"Plant geo query failed: {exc}")
    else:
        for r in rows:
            plant_id = _row_get(r, "plant_id", "PLANT_ID")
            if plant_id in metadata:
                metadata[plant_id]["lat"] = float(_row_get(r, "lat", "LAT", default=0.0) or 0.0)
                metadata[plant_id]["lon"] = float(_row_get(r, "lon", "LON", default=0.0) or 0.0)

    plant_sql = f"""
        SELECT
            PLANT_ID,
            PLANT_NAME,
            COUNTRY_ID,
            CITY
        FROM {PLANT_TBL}
        WHERE PLANT_ID IN ({id_list})
    """
    try:
        rows = await run_sql_async(token, plant_sql)
    except Exception as exc:
        logging.warning(f"Plant metadata query failed: {exc}")
    else:
        for r in rows:
            plant_id = _row_get(r, "PLANT_ID", "plant_id")
            if plant_id in metadata:
                metadata[plant_id].update({
                    "plant_name": _row_get(r, "PLANT_NAME", "plant_name", default=plant_id) or plant_id,
                    "country": _row_get(r, "COUNTRY_ID", "country_id", default="") or "",
                    "city": _row_get(r, "CITY", "city", default="") or "",
                })

    return metadata


async def _fetch_plant_kpis(token: str, plant_id: str, days: int = 30) -> PlantKpis:
    """KPI summary for one plant over the given number of days."""
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
    try:
        rows = await run_sql_async(token, sql, params)
    except Exception as exc:
        logging.warning(f"KPI query failed for plant {plant_id}: {exc}")
        return PlantKpis()

    if not rows:
        return PlantKpis()

    r = rows[0]
    total = int(r.get("total_locs") or 0)
    pass_locs = int(r.get("pass_locs") or 0)
    pass_rate = round(pass_locs / total * 100, 1) if total > 0 else 100.0

    return PlantKpis(
        total_locs=total,
        active_fails=int(r.get("active_fails") or 0),
        warnings=int(r.get("warnings") or 0),
        pending=int(r.get("pending") or 0),
        pass_rate=pass_rate,
        lots_tested=int(r.get("lots_tested") or 0),
        lots_planned=int(r.get("lots_tested") or 0),
        risk_index=0.0,
        pathogen_hits=0,
    )


async def _count_floors(token: str, plant_id: str) -> int:
    params = [sql_param("plant_id", plant_id)]
    sql = f"SELECT COUNT(*) AS n FROM {FLOOR_TBL} WHERE plant_id = :plant_id"
    try:
        rows = await run_sql_async(token, sql, params)
        return int(rows[0].get("n") or 0) if rows else 0
    except Exception:
        return 0


@router.get("/plants", response_model=list[PlantInfo])
async def list_plants(
    days: int = Query(default=30, ge=7, le=730),
    x_forwarded_access_token: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    token = resolve_token(x_forwarded_access_token, authorization)

    plant_ids = await _fetch_active_plant_ids(token)
    if not plant_ids:
        return []

    metadata, kpi_results, floor_counts = await asyncio.gather(
        _fetch_plant_metadata(token, plant_ids),
        asyncio.gather(*[_fetch_plant_kpis(token, pid, days) for pid in plant_ids]),
        asyncio.gather(*[_count_floors(token, pid) for pid in plant_ids]),
    )

    results = []
    for pid, kpis, floors in zip(plant_ids, kpi_results, floor_counts):
        meta = metadata.get(pid, {})
        results.append(PlantInfo(
            plant_id=pid,
            plant_name=meta.get("plant_name", pid),
            plant_code=pid,
            country=meta.get("country", ""),
            region=meta.get("region", "EMEA"),
            city=meta.get("city", ""),
            product="",
            employees=0,
            lat=meta.get("lat", 0.0),
            lon=meta.get("lon", 0.0),
            floors=floors,
            kpis=kpis,
        ))

    return results
