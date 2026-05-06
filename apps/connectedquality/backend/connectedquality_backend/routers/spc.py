"""SPC module routers."""

from fastapi import APIRouter, Depends, Query

from shared_auth.identity import require_proxy_user, UserIdentity
from connectedquality_backend.application.spc import fetch_process_flow, fetch_scorecard

router = APIRouter()


@router.get("/spc/charts")
async def spc_charts(
    material: str = Query(..., description="Material selected by the user/session/deep link."),
    char: str = Query(..., description="Characteristic selected by the user/session/deep link."),
    line: str | None = Query(default=None, description="Optional production line context."),
    user: UserIdentity = Depends(require_proxy_user),
):
    """Individual value series and control limits for the selected characteristic."""
    return {
        "material": material,
        "line": line,
        "characteristic": char,
        "n": 0,
        "mean": None,
        "ucl": None,
        "lcl": None,
        "data": [],
        "ooc_indices": [],
    }


@router.get("/spc/scorecard")
async def spc_scorecard(
    material: str = Query(..., description="Material selected by the user/session/deep link."),
    line: str | None = Query(default=None, description="Optional production line context."),
    user: UserIdentity = Depends(require_proxy_user),
):
    """Cpk / Ppk scorecard for all characteristics of the selected material+line."""
    # We pass None for date_from, date_to, plant_id to match the stub signature defaults
    token = user.raw_token
    rows = await fetch_scorecard(token, material_id=material, plant_id=None, date_from=None, date_to=None)
    return {
        "material": material,
        "line": line,
        "rows": rows,
    }


@router.get("/spc/flow")
async def spc_flow(
    material: str = Query(..., description="Material selected by the user/session/deep link."),
    user: UserIdentity = Depends(require_proxy_user),
):
    """Process DAG with stage-level Cpk health."""
    token = user.raw_token
    flow_data = await fetch_process_flow(token, material_id=material, date_from=None, date_to=None)
    return {
        "material": material,
        "stages": flow_data.get("nodes", []),
        "edges": flow_data.get("edges", []),
    }
