"""
Inspection Analysis bounded context — read-only endpoints over gold-layer data.

Endpoints:
    GET /api/em/plants                       — portfolio discovery + KPIs
    GET /api/em/heatmap                      — floor heatmap with risk/status/SPC
    GET /api/em/locations                    — functional locations for a plant/floor
    GET /api/em/locations/{id}/summary       — location detail with MICs + recent lots
    GET /api/em/mics                         — distinct MIC names for a plant/location
    GET /api/em/trends                       — MIC time-series for a location
    GET /api/em/lots                         — inspection lots for a location
    GET /api/em/lots/{lot_id}                — MIC results for a specific lot
"""

import asyncio
import logging
import os
from collections import defaultdict
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query

from backend.inspection_analysis.dal import heatmap as heatmap_dal
from backend.inspection_analysis.dal import lots as lots_dal
from backend.inspection_analysis.dal import plants as plants_dal
from backend.inspection_analysis.dal import trends as trends_dal
from backend.inspection_analysis.domain.risk import calculate_risk_score
from backend.inspection_analysis.domain.spc import detect_early_warning
from backend.inspection_analysis.domain.status import derive_location_status, lot_status
from backend.schemas.em import (
    FloorInfo,
    HeatmapResponse,
    InspectionLot,
    LocationMeta,
    LocationSummary,
    LotDetailResponse,
    MarkerData,
    MicResult,
    PlantInfo,
    PlantKpis,
    TrendPoint,
    TrendResponse,
)
from backend.spatial_config.dal import coordinates as coordinates_dal
from backend.spatial_config.dal import floors as floors_dal
from backend.utils.em_config import MIC_DECAY_RATES
from shared_auth import UserIdentity, require_proxy_user

router = APIRouter()
logger = logging.getLogger(__name__)

_DEFAULT_LAMBDA: float = min(
    max(float(os.environ.get("EM_DEFAULT_DECAY_LAMBDA", "0.1").strip()), 0.0), 1.0
)


# ---------------------------------------------------------------------------
# Plants
# ---------------------------------------------------------------------------

def _build_plant_metadata(
    plant_ids: list[str],
    geo_rows: list[dict],
    meta_rows: list[dict],
) -> dict[str, dict]:
    """Merge geo and name/country rows into a keyed metadata dict with safe defaults."""
    metadata: dict[str, dict] = {
        pid: {"plant_name": pid, "country": "", "region": "EMEA", "city": "", "lat": 0.0, "lon": 0.0}
        for pid in plant_ids
    }
    for r in geo_rows:
        pid = r.get("plant_id") or r.get("PLANT_ID")
        if pid and pid in metadata:
            metadata[pid]["lat"] = float(r.get("lat") or r.get("LAT") or 0.0)
            metadata[pid]["lon"] = float(r.get("lon") or r.get("LON") or 0.0)
    for r in meta_rows:
        pid = r.get("PLANT_ID") or r.get("plant_id")
        if pid and pid in metadata:
            metadata[pid].update({
                "plant_name": r.get("PLANT_NAME") or r.get("plant_name") or pid,
                "country": r.get("COUNTRY_ID") or r.get("country_id") or "",
                "city": r.get("CITY") or r.get("city") or "",
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
    r = rows[0]
    total = int(r.get("total_locs") or 0)
    pass_locs = int(r.get("pass_locs") or 0)
    return PlantKpis(
        total_locs=total,
        active_fails=int(r.get("active_fails") or 0),
        warnings=int(r.get("warnings") or 0),
        pending=int(r.get("pending") or 0),
        pass_rate=round(pass_locs / total * 100, 1) if total > 0 else 100.0,
        lots_tested=int(r.get("lots_tested") or 0),
        lots_planned=int(r.get("lots_tested") or 0),
        risk_index=0.0,
        pathogen_hits=0,
    )


async def _safe_count_floors(token: str, plant_id: str) -> int:
    try:
        rows = await plants_dal.count_plant_floors(token, plant_id)
        return int(rows[0].get("n") or 0) if rows else 0
    except Exception:
        return 0


@router.get("/plants", response_model=list[PlantInfo])
async def list_plants(
    user: UserIdentity = Depends(require_proxy_user),
    days: int = Query(default=30, ge=7, le=730),
):
    """List all EM-active plants enriched with geo coordinates and rolling KPIs."""
    token = user.raw_token

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
            plant_ids, kpi_results, floor_counts,
            [metadata.get(pid, {}) for pid in plant_ids],
        )
    ]


# ---------------------------------------------------------------------------
# Floors (read — spatial_config DAL, inspection_analysis consumer)
# ---------------------------------------------------------------------------

@router.get("/floors", response_model=list[FloorInfo])
async def list_floors(
    plant_id: str = Query(..., description="SAP plant code"),
    user: UserIdentity = Depends(require_proxy_user),
):
    """List floors for a plant with mapped location counts."""
    token = user.raw_token
    floors_rows, count_rows = await asyncio.gather(
        floors_dal.fetch_floors(token, plant_id),
        floors_dal.fetch_floor_location_counts(token, plant_id),
    )
    count_map = {r["floor_id"]: int(r["location_count"] or 0) for r in count_rows}
    return [
        FloorInfo(
            floor_id=r["floor_id"],
            floor_name=r["floor_name"],
            location_count=count_map.get(r["floor_id"], 0),
            svg_url=r.get("svg_url"),
            svg_width=float(r["svg_width"]) if r.get("svg_width") is not None else None,
            svg_height=float(r["svg_height"]) if r.get("svg_height") is not None else None,
        )
        for r in floors_rows
    ]


# ---------------------------------------------------------------------------
# Heatmap
# ---------------------------------------------------------------------------

@router.get("/heatmap", response_model=HeatmapResponse)
async def get_heatmap(
    plant_id: str = Query(...),
    floor_id: str = Query(...),
    user: UserIdentity = Depends(require_proxy_user),
    mics: Optional[list[str]] = Query(None),
    time_window_days: int = Query(30, ge=7, le=365),
    decay_lambda: Optional[float] = Query(None, ge=0.0, le=1.0),
    as_of_date: Optional[date] = Query(None),
):
    """
    Generate heatmap markers for a floor plan.

    Two modes:
    - Deterministic (no decay_lambda): latest result per location drives status.
    - Continuous (decay_lambda set): exponential time-decay risk score drives status,
      with hard override for any active rejection.

    SPC early-warning detection applies in both modes: three strictly increasing
    quantitative results escalate a PASS marker to WARNING.
    """
    token = user.raw_token
    reference_date = as_of_date or date.today()
    date_from = (reference_date - timedelta(days=time_window_days)).isoformat()
    date_to = reference_date.isoformat()
    applied_lambda = decay_lambda if decay_lambda is not None else _DEFAULT_LAMBDA
    continuous_mode = decay_lambda is not None

    rows = await heatmap_dal.fetch_heatmap_rows(
        token, plant_id, floor_id, date_from, date_to, mics
    )

    by_loc: dict[str, list[dict]] = defaultdict(list)
    coords: dict[str, dict] = {}
    for r in rows:
        lid = str(r["func_loc_id"])
        by_loc[lid].append(r)
        coords[lid] = {
            "floor_id": str(r["floor_id"]),
            "x": float(r["x_pos"]),
            "y": float(r["y_pos"]),
        }

    markers: list[MarkerData] = []
    for lid, loc_rows in by_loc.items():
        risk = calculate_risk_score(loc_rows, reference_date, applied_lambda)
        early_warning = detect_early_warning(loc_rows)
        status = derive_location_status(loc_rows, risk, continuous_mode, early_warning)

        fails = sum(1 for r in loc_rows if (r.get("valuation") or "").upper() in ("R", "REJ", "REJECT"))
        passes = sum(1 for r in loc_rows if (r.get("valuation") or "").upper() in ("A", "ACC", "ACCEPT"))

        c = coords[lid]
        markers.append(MarkerData(
            func_loc_id=lid,
            floor_id=c["floor_id"],
            x_pos=c["x"],
            y_pos=c["y"],
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


# ---------------------------------------------------------------------------
# Locations
# ---------------------------------------------------------------------------

@router.get("/locations", response_model=list[LocationMeta])
async def list_locations(
    plant_id: str = Query(..., description="SAP plant code"),
    floor_id: Optional[str] = Query(default=None),
    mapped_only: bool = Query(default=False),
    user: UserIdentity = Depends(require_proxy_user),
):
    """List functional locations for a plant with coordinate mapping status."""
    token = user.raw_token
    rows = await coordinates_dal.fetch_locations(token, plant_id, floor_id, mapped_only)
    return [
        LocationMeta(
            func_loc_id=r["func_loc_id"],
            func_loc_name=None,
            plant_id=plant_id,
            floor_id=r.get("floor_id"),
            x_pos=float(r["x_pos"]) if r.get("x_pos") is not None else None,
            y_pos=float(r["y_pos"]) if r.get("y_pos") is not None else None,
            is_mapped=bool(r.get("is_mapped", False)),
        )
        for r in rows
    ]


@router.get("/locations/{func_loc_id}/summary", response_model=LocationSummary)
async def get_location_summary(
    func_loc_id: str,
    plant_id: str = Query(..., description="SAP plant code"),
    user: UserIdentity = Depends(require_proxy_user),
):
    """Return coordinate metadata, distinct MICs, and 5 most recent lots for a location."""
    token = user.raw_token
    date_from = (date.today() - timedelta(days=180)).isoformat()

    meta_rows, mic_rows, lot_rows = await asyncio.gather(
        coordinates_dal.fetch_location_coordinate(token, plant_id, func_loc_id),
        lots_dal.fetch_location_mics(token, plant_id, func_loc_id, date_from),
        lots_dal.fetch_location_recent_lots(token, plant_id, func_loc_id, date_from),
    )

    if meta_rows:
        r = meta_rows[0]
        meta = LocationMeta(
            func_loc_id=r["func_loc_id"], plant_id=plant_id,
            floor_id=r["floor_id"], x_pos=float(r["x_pos"]),
            y_pos=float(r["y_pos"]), is_mapped=True,
        )
    else:
        meta = LocationMeta(func_loc_id=func_loc_id, plant_id=plant_id, is_mapped=False)

    mics = [r["mic_name"] for r in mic_rows if r.get("mic_name")]
    recent_lots = [
        {
            "lot_id": r["lot_id"],
            "func_loc_id": r["func_loc_id"],
            "inspection_start_date": str(r["inspection_start_date"])[:10] if r.get("inspection_start_date") else None,
            "inspection_end_date":   str(r["inspection_end_date"])[:10]   if r.get("inspection_end_date")   else None,
            "valuation": r["valuation"],
            "status": lot_status(r["valuation"], r.get("inspection_end_date")),
        }
        for r in lot_rows
    ]
    return LocationSummary(meta=meta, mics=mics, recent_lots=recent_lots)


# ---------------------------------------------------------------------------
# MICs / Trends
# ---------------------------------------------------------------------------

@router.get("/mics", response_model=list[str])
async def list_mics(
    plant_id: str = Query(..., description="SAP plant code"),
    func_loc_id: Optional[str] = Query(None),
    user: UserIdentity = Depends(require_proxy_user),
):
    """List distinct normalised MIC names for a plant, optionally filtered to one location."""
    token = user.raw_token
    date_from = (date.today() - timedelta(days=180)).isoformat()
    rows = await trends_dal.fetch_mics(token, plant_id, func_loc_id, date_from)
    return [r["mic_name"] for r in rows if r.get("mic_name")]


@router.get("/trends", response_model=TrendResponse)
async def get_trends(
    plant_id: str = Query(..., description="SAP plant code"),
    func_loc_id: str = Query(...),
    mic_name: str = Query(...),
    window_days: int = Query(90, ge=1, le=365),
    user: UserIdentity = Depends(require_proxy_user),
):
    """Return chronological MIC result time-series for one location."""
    token = user.raw_token
    date_from = (date.today() - timedelta(days=window_days)).isoformat()
    rows = await trends_dal.fetch_trends(
        token, plant_id, func_loc_id, mic_name.upper().strip(), date_from
    )
    points = [
        TrendPoint(
            inspection_date=str(r["inspection_date"])[:10],
            mic_name=r["mic_name"],
            result_value=float(r["result_value"]) if r.get("result_value") is not None else None,
            valuation=r.get("valuation"),
            upper_limit=float(r["upper_limit"]) if r.get("upper_limit") is not None else None,
            lower_limit=float(r["lower_limit"]) if r.get("lower_limit") is not None else None,
        )
        for r in rows
    ]
    return TrendResponse(func_loc_id=func_loc_id, mic_name=mic_name, window_days=window_days, points=points)


# ---------------------------------------------------------------------------
# Inspection Lots
# ---------------------------------------------------------------------------

@router.get("/lots", response_model=list[InspectionLot])
async def list_lots(
    plant_id: str = Query(..., description="SAP plant code"),
    func_loc_id: str = Query(...),
    time_window_days: int = Query(90, ge=1, le=365),
    user: UserIdentity = Depends(require_proxy_user),
):
    """List inspection lots for a functional location within the time window."""
    token = user.raw_token
    date_from = (date.today() - timedelta(days=time_window_days)).isoformat()
    rows = await lots_dal.fetch_lots(token, plant_id, func_loc_id, date_from)
    return [
        InspectionLot(
            lot_id=r["lot_id"],
            func_loc_id=r["func_loc_id"],
            inspection_start_date=str(r["inspection_start_date"])[:10] if r.get("inspection_start_date") else None,
            inspection_end_date=str(r["inspection_end_date"])[:10] if r.get("inspection_end_date") else None,
            valuation=r.get("valuation"),
            status=lot_status(r.get("valuation"), r.get("inspection_end_date")),
        )
        for r in rows
    ]


@router.get("/lots/{lot_id}", response_model=LotDetailResponse)
async def get_lot_detail(
    lot_id: str,
    plant_id: str = Query(..., description="SAP plant code"),
    user: UserIdentity = Depends(require_proxy_user),
):
    """Return individual MIC results for a specific inspection lot."""
    token = user.raw_token
    rows = await lots_dal.fetch_lot_detail(token, lot_id, plant_id)
    return LotDetailResponse(
        lot_id=lot_id,
        mic_results=[
            MicResult(
                lot_id=r["lot_id"],
                mic_id=r.get("mic_id", ""),
                mic_name=r["mic_name"],
                result_value=float(r["result_value"]) if r.get("result_value") is not None else None,
                valuation=r.get("valuation"),
                upper_limit=float(r["upper_limit"]) if r.get("upper_limit") is not None else None,
                lower_limit=float(r["lower_limit"]) if r.get("lower_limit") is not None else None,
            )
            for r in rows
        ],
    )
