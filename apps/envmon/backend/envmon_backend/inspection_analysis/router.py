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

import os
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query

from envmon_backend.inspection_analysis.application import queries as inspection_queries
from envmon_backend.schemas.em import (
    FloorInfo,
    HeatmapResponse,
    InspectionLot,
    LocationMeta,
    LocationSummary,
    LotDetailResponse,
    PlantInfo,
    TrendResponse,
)
from envmon_backend.spatial_config.application import queries as spatial_queries
from envmon_backend.utils.em_config import MIC_DECAY_RATES
from shared_auth import UserIdentity, require_proxy_user

router = APIRouter()

_DEFAULT_LAMBDA: float = min(
    max(float(os.environ.get("EM_DEFAULT_DECAY_LAMBDA", "0.1").strip()), 0.0), 1.0
)


@router.get("/plants", response_model=list[PlantInfo])
async def list_plants(
    user: UserIdentity = Depends(require_proxy_user),
    days: int = Query(default=30, ge=7, le=730),
):
    """List all EM-active plants enriched with geo coordinates and rolling KPIs."""
    return await inspection_queries.list_plants(user.raw_token, days)


# ---------------------------------------------------------------------------
# Floors (read — spatial_config DAL, inspection_analysis consumer)
# ---------------------------------------------------------------------------

@router.get("/floors", response_model=list[FloorInfo])
async def list_floors(
    plant_id: str = Query(..., description="SAP plant code"),
    user: UserIdentity = Depends(require_proxy_user),
):
    """List floors for a plant with mapped location counts."""
    return await spatial_queries.list_floors(user.raw_token, plant_id)


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
    reference_date = as_of_date or date.today()
    return await inspection_queries.get_heatmap(
        user.raw_token,
        plant_id=plant_id,
        floor_id=floor_id,
        mics=mics,
        time_window_days=time_window_days,
        decay_lambda=decay_lambda,
        reference_date=reference_date,
        default_decay_lambda=_DEFAULT_LAMBDA,
        mic_decay_rates=MIC_DECAY_RATES,
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
    return await spatial_queries.list_locations(user.raw_token, plant_id, floor_id, mapped_only)


@router.get("/locations/{func_loc_id}/summary", response_model=LocationSummary)
async def get_location_summary(
    func_loc_id: str,
    plant_id: str = Query(..., description="SAP plant code"),
    user: UserIdentity = Depends(require_proxy_user),
):
    """Return coordinate metadata, distinct MICs, and 5 most recent lots for a location."""
    return await inspection_queries.get_location_summary(user.raw_token, plant_id, func_loc_id, date.today())


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
    return await inspection_queries.list_mics(user.raw_token, plant_id, func_loc_id, date.today())


@router.get("/trends", response_model=TrendResponse)
async def get_trends(
    plant_id: str = Query(..., description="SAP plant code"),
    func_loc_id: str = Query(...),
    mic_name: str = Query(...),
    window_days: int = Query(90, ge=1, le=365),
    user: UserIdentity = Depends(require_proxy_user),
):
    """Return chronological MIC result time-series for one location."""
    return await inspection_queries.get_trends(
        user.raw_token,
        plant_id,
        func_loc_id,
        mic_name,
        window_days,
        date.today(),
    )


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
    return await inspection_queries.list_lots(
        user.raw_token,
        plant_id,
        func_loc_id,
        time_window_days,
        date.today(),
    )


@router.get("/lots/{lot_id}", response_model=LotDetailResponse)
async def get_lot_detail(
    lot_id: str,
    plant_id: str = Query(..., description="SAP plant code"),
    user: UserIdentity = Depends(require_proxy_user),
):
    """Return individual MIC results for a specific inspection lot."""
    return await inspection_queries.get_lot_detail(user.raw_token, lot_id, plant_id)
