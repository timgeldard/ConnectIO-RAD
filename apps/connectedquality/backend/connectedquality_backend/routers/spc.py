"""SPC module routers — returns real data from spc_backend DALs where possible.

Replace mock returns with DAL queries once the CQ data layer is wired.
"""

from fastapi import APIRouter, Depends

from shared_auth.identity import require_proxy_user, UserIdentity
from spc_backend.process_control.dal.analysis import fetch_scorecard, fetch_process_flow

router = APIRouter()


@router.get("/spc/charts")
async def spc_charts(material: str = "20582002", line: str = "L4", char: str = "moisture", user: UserIdentity = Depends(require_proxy_user)):
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
async def spc_scorecard(material: str = "20582002", line: str = "L4", user: UserIdentity = Depends(require_proxy_user)):
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
async def spc_flow(material: str = "20582002", user: UserIdentity = Depends(require_proxy_user)):
    """Process DAG with stage-level Cpk health."""
    token = user.raw_token
    flow_data = await fetch_process_flow(token, material_id=material, date_from=None, date_to=None)
    return {
        "material": material,
        "stages": flow_data.get("nodes", []),
        "edges": flow_data.get("edges", []),
    }
edges", []),
    }
