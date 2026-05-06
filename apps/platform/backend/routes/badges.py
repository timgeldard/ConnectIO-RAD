"""Platform badge counts aggregator.

Collects alarm / attention-signal counts from each integrated sub-backend
and returns them keyed by moduleId so the platform shell can render red
badge dots on left-rail icons.
"""
import logging
from fastapi import APIRouter, Depends

from shared_auth.identity import require_proxy_user, UserIdentity
from backend.utils import _optional_attr

logger = logging.getLogger(__name__)
router = APIRouter()

# Hoist the optional CQ alarms getter to avoid circular imports and enable tracking.
_get_cq_alarms = _optional_attr(
    "connectedquality_backend.routers.alarms",
    "get_alarms",
    "connectedquality_backend",
)


async def _fetch_cq_counts() -> dict[str, int]:
    """Return alarm counts for CQ modules (trace, envmon, spc).

    Calls the CQ alarms stub; returns mapped counts once the CQ data layer is wired.
    """
    if _get_cq_alarms is None:
        return {"spc": 0, "envmon": 0, "trace": 0}

    try:
        result = await _get_cq_alarms()
        open_count: int = result.get("open", 0)
        # TODO: Wire to per-module counts once available in CQ backend.
        # For now, we apply the aggregate "open" count to all three as a signal.
        return {
            "spc": open_count,
            "envmon": open_count,
            "trace": open_count,
        }
    except Exception as exc:
        logger.exception("Failed to fetch CQ alarm counts: %s", exc)
        return {"spc": 0, "envmon": 0, "trace": 0}


@router.get("/api/badges", tags=["Platform"])
async def get_badge_counts(
    user: UserIdentity = Depends(require_proxy_user),
) -> dict[str, int]:
    """Return attention-signal counts keyed by moduleId.

    Zero-valued modules are omitted from the response; the shell treats
    a missing key as zero. Polled by the frontend every 60 s.
    """
    counts: dict[str, int] = {}
    counts.update(await _fetch_cq_counts())
    return {k: v for k, v in counts.items() if v > 0}
