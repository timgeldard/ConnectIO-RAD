"""Platform badge counts aggregator.

Collects alarm / attention-signal counts from each integrated sub-backend
and returns them keyed by moduleId so the platform shell can render red
badge dots on left-rail icons.

Extend _fetch_counts() when sub-backends expose real alarm-count endpoints.
"""

from fastapi import APIRouter

router = APIRouter()


async def _fetch_cq_counts() -> dict[str, int]:
    """Return alarm counts for CQ modules (trace, envmon, spc).

    Calls the CQ alarms stub; extend once the CQ data layer is wired.
    """
    try:
        from cq_backend.routers.alarms import get_alarms  # type: ignore[import-not-found]
        result = await get_alarms()
        open_count: int = result.get("open", 0)
        return {
            "spc": open_count,
            "envmon": 0,
            "trace": 0,
        }
    except Exception:
        return {"spc": 0, "envmon": 0, "trace": 0}


@router.get("/api/badges", tags=["Platform"])
async def get_badge_counts() -> dict[str, int]:
    """Return attention-signal counts keyed by moduleId.

    Zero-valued modules are omitted from the response; the shell treats
    a missing key as zero. Polled by the frontend every 60 s.
    """
    counts: dict[str, int] = {}
    counts.update(await _fetch_cq_counts())
    return {k: v for k, v in counts.items() if v > 0}
