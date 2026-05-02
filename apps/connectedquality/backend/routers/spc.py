"""SPC module stub routers — returns mock data matching the handoff shape.

Replace mock returns with DAL queries once the CQ data layer is wired.
"""

from fastapi import APIRouter

router = APIRouter()


@router.get("/spc/charts")
async def spc_charts(material: str = "20582002", line: str = "L4", char: str = "moisture"):
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
async def spc_scorecard(material: str = "20582002", line: str = "L4"):
    """Cpk / Ppk scorecard for all characteristics of the selected material+line."""
    return {
        "material": material,
        "line": line,
        "rows": [],
    }


@router.get("/spc/flow")
async def spc_flow(material: str = "20582002"):
    """Process DAG with stage-level Cpk health."""
    return {
        "material": material,
        "stages": [],
        "edges": [],
    }
