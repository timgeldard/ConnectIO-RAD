"""Application query handlers for the inspection_analysis bounded context."""

from __future__ import annotations

import asyncio
import logging
from collections import defaultdict
from datetime import date, timedelta
from typing import Optional

from backend.inspection_analysis.dal import heatmap as heatmap_dal
from backend.inspection_analysis.dal import lots as lots_dal
from backend.inspection_analysis.dal import plants as plants_dal
from backend.inspection_analysis.dal import trends as trends_dal
from backend.inspection_analysis.domain.risk import calculate_risk_score
from backend.inspection_analysis.domain.spc import detect_early_warning
from backend.inspection_analysis.domain.status import derive_location_status, lot_status
from backend.schemas.em import (
    HeatmapResponse,
    InspectionLot,
    LocationSummary,
    LotDetailResponse,
    MarkerData,
    MicResult,
    PlantInfo,
    PlantKpis,
    TrendPoint,
    TrendResponse,
)
from backend.spatial_config.application import queries as spatial_queries

logger = logging.getLogger(__name__)


def _build_plant_metadata(
    plant_ids: list[str],
    geo_rows: list[dict],
    meta_rows: list[dict],
) -> dict[str, dict]:
    metadata: dict[str, dict] = {
        pid: {"plant_name": pid, "country": "", "region": "EMEA", "city": "", "lat": 0.0, "lon": 0.0}
        for pid in plant_ids
    }
    for row in geo_rows:
        pid = row.get("plant_id") or row.get("PLANT_ID")
        if pid and pid in metadata:
            metadata[pid]["lat"] = float(row.get("lat") or row.get("LAT") or 0.0)
            metadata[pid]["lon"] = float(row.get("lon") or row.get("LON") or 0.0)
    for row in meta_rows:
        pid = row.get("PLANT_ID") or row.get("plant_id")
        if pid and pid in metadata:
            metadata[pid].update({
                "plant_name": row.get("PLANT_NAME") or row.get("plant_name") or pid,
                "country": row.get("COUNTRY_ID") or row.get("country_id") or "",
                "city": row.get("CITY") or row.get("city") or "",
            })
    return metadata


async def _safe_fetch_geo(token: str, plant_ids: list[str]) -> list[dict]:
    try:
        return await plants_dal.fetch_plant_geo(token, plant_ids)
    except Exception as exc:
        logger.warning("Plant geo query failed: %s", exc)
        return []


async def _safe_fetch_meta(token: str, plant_ids: list[str]) -> list[dict]:
    try:
        return await plants_dal.fetch_plant_metadata(token, plant_ids)
    except Exception as exc:
        logger.warning("Plant metadata query failed: %s", exc)
        return []


async def _safe_fetch_kpis(token: str, plant_id: str, days: int) -> PlantKpis:
    try:
        rows = await plants_dal.fetch_plant_kpis(token, plant_id, days)
    except Exception as exc:
        logger.warning("KPI query failed for plant %s: %s", plant_id, exc)
        return PlantKpis()
    if not rows:
        return PlantKpis()
    row = rows[0]
    total = int(row.get("total_locs") or 0)
    pass_locs = int(row.get("pass_locs") or 0)
    return PlantKpis(
        total_locs=total,
        active_fails=int(row.get("active_fails") or 0),
        warnings=int(row.get("warnings") or 0),
        pending=int(row.get("pending") or 0),
        pass_rate=round(pass_locs / total * 100, 1) if total > 0 else 100.0,
        lots_tested=int(row.get("lots_tested") or 0),
        lots_planned=int(row.get("lots_tested") or 0),
        risk_index=0.0,
        pathogen_hits=0,
    )


async def _safe_count_floors(token: str, plant_id: str) -> int:
    try:
        rows = await plants_dal.count_plant_floors(token, plant_id)
        return int(rows[0].get("n") or 0) if rows else 0
    except Exception:
        return 0


async def list_plants(token: str, days: int) -> list[PlantInfo]:
    plant_ids = await plants_dal.fetch_active_plant_ids(token)
    if not plant_ids:
        return []

    geo_rows, meta_rows, kpi_results, floor_counts = await asyncio.gather(
        _safe_fetch_geo(token, plant_ids),
        _safe_fetch_meta(token, plant_ids),
        asyncio.gather(*[_safe_fetch_kpis(token, pid, days) for pid in plant_ids]),
        asyncio.gather(*[_safe_count_floors(token, pid) for pid in plant_ids]),
    )
    metadata = _build_plant_metadata(plant_ids, geo_rows, meta_rows)
    return [
        PlantInfo(
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
        )
        for pid, kpis, floors, meta in zip(
            plant_ids,
            kpi_results,
            floor_counts,
            [metadata.get(pid, {}) for pid in plant_ids],
        )
    ]


async def get_heatmap(
    token: str,
    *,
    plant_id: str,
    floor_id: str,
    mics: Optional[list[str]],
    time_window_days: int,
    decay_lambda: Optional[float],
    reference_date: date,
    default_decay_lambda: float,
    mic_decay_rates: dict[str, float],
) -> HeatmapResponse:
    date_from = (reference_date - timedelta(days=time_window_days)).isoformat()
    date_to = reference_date.isoformat()
    applied_lambda = decay_lambda if decay_lambda is not None else default_decay_lambda
    continuous_mode = decay_lambda is not None

    rows = await heatmap_dal.fetch_heatmap_rows(token, plant_id, floor_id, date_from, date_to, mics)
    by_loc: dict[str, list[dict]] = defaultdict(list)
    coords: dict[str, dict] = {}
    for row in rows:
        location_id = str(row["func_loc_id"])
        by_loc[location_id].append(row)
        coords[location_id] = {
            "floor_id": str(row["floor_id"]),
            "x": float(row["x_pos"]),
            "y": float(row["y_pos"]),
        }

    markers: list[MarkerData] = []
    for location_id, loc_rows in by_loc.items():
        risk = calculate_risk_score(loc_rows, reference_date, applied_lambda, mic_decay_rates)
        early_warning = detect_early_warning(loc_rows)
        status = derive_location_status(loc_rows, risk, continuous_mode, early_warning)
        fails = sum(1 for row in loc_rows if (row.get("valuation") or "").upper() in ("R", "REJ", "REJECT"))
        passes = sum(1 for row in loc_rows if (row.get("valuation") or "").upper() in ("A", "ACC", "ACCEPT"))
        coord = coords[location_id]
        markers.append(MarkerData(
            func_loc_id=location_id,
            floor_id=coord["floor_id"],
            x_pos=coord["x"],
            y_pos=coord["y"],
            status=status,
            fail_count=fails,
            pass_count=passes,
            total_count=len(loc_rows),
            risk_score=round(risk, 2),
        ))

    return HeatmapResponse(
        floor_id=floor_id,
        mode="continuous" if continuous_mode else "deterministic",
        time_window_days=time_window_days,
        decay_lambda=applied_lambda,
        markers=markers,
    )


async def get_location_summary(token: str, plant_id: str, func_loc_id: str, reference_date: date) -> LocationSummary:
    date_from = (reference_date - timedelta(days=180)).isoformat()
    meta, mic_rows, lot_rows = await asyncio.gather(
        spatial_queries.get_location_coordinate(token, plant_id, func_loc_id),
        lots_dal.fetch_location_mics(token, plant_id, func_loc_id, date_from),
        lots_dal.fetch_location_recent_lots(token, plant_id, func_loc_id, date_from),
    )
    return LocationSummary(
        meta=meta,
        mics=[row["mic_name"] for row in mic_rows if row.get("mic_name")],
        recent_lots=[
            {
                "lot_id": row["lot_id"],
                "func_loc_id": row["func_loc_id"],
                "inspection_start_date": str(row["inspection_start_date"])[:10] if row.get("inspection_start_date") else None,
                "inspection_end_date": str(row["inspection_end_date"])[:10] if row.get("inspection_end_date") else None,
                "valuation": row["valuation"],
                "status": lot_status(row["valuation"], row.get("inspection_end_date")),
            }
            for row in lot_rows
        ],
    )


async def list_mics(token: str, plant_id: str, func_loc_id: Optional[str], reference_date: date) -> list[str]:
    date_from = (reference_date - timedelta(days=180)).isoformat()
    rows = await trends_dal.fetch_mics(token, plant_id, func_loc_id, date_from)
    return [row["mic_name"] for row in rows if row.get("mic_name")]


async def get_trends(
    token: str,
    plant_id: str,
    func_loc_id: str,
    mic_name: str,
    window_days: int,
    reference_date: date,
) -> TrendResponse:
    date_from = (reference_date - timedelta(days=window_days)).isoformat()
    rows = await trends_dal.fetch_trends(token, plant_id, func_loc_id, mic_name.upper().strip(), date_from)
    points = [
        TrendPoint(
            inspection_date=str(row["inspection_date"])[:10],
            mic_name=row["mic_name"],
            result_value=float(row["result_value"]) if row.get("result_value") is not None else None,
            valuation=row.get("valuation"),
            upper_limit=float(row["upper_limit"]) if row.get("upper_limit") is not None else None,
            lower_limit=float(row["lower_limit"]) if row.get("lower_limit") is not None else None,
        )
        for row in rows
    ]
    return TrendResponse(func_loc_id=func_loc_id, mic_name=mic_name, window_days=window_days, points=points)


async def list_lots(token: str, plant_id: str, func_loc_id: str, time_window_days: int, reference_date: date) -> list[InspectionLot]:
    date_from = (reference_date - timedelta(days=time_window_days)).isoformat()
    rows = await lots_dal.fetch_lots(token, plant_id, func_loc_id, date_from)
    return [
        InspectionLot(
            lot_id=row["lot_id"],
            func_loc_id=row["func_loc_id"],
            inspection_start_date=str(row["inspection_start_date"])[:10] if row.get("inspection_start_date") else None,
            inspection_end_date=str(row["inspection_end_date"])[:10] if row.get("inspection_end_date") else None,
            valuation=row.get("valuation"),
            status=lot_status(row.get("valuation"), row.get("inspection_end_date")),
        )
        for row in rows
    ]


async def get_lot_detail(token: str, lot_id: str, plant_id: str) -> LotDetailResponse:
    rows = await lots_dal.fetch_lot_detail(token, lot_id, plant_id)
    return LotDetailResponse(
        lot_id=lot_id,
        mic_results=[
            MicResult(
                lot_id=row["lot_id"],
                mic_id=row.get("mic_id", ""),
                mic_name=row["mic_name"],
                result_value=float(row["result_value"]) if row.get("result_value") is not None else None,
                valuation=row.get("valuation"),
                upper_limit=float(row["upper_limit"]) if row.get("upper_limit") is not None else None,
                lower_limit=float(row["lower_limit"]) if row.get("lower_limit") is not None else None,
            )
            for row in rows
        ],
    )
