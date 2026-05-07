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


async def _fetch_cq_counts(user: UserIdentity) -> dict[str, int]:
    """Return alarm counts for CQ modules (trace, envmon, spc).

    Prefer per-alarm source counts. If CQ only returns an aggregate count, do not
    fan that out to every module because that creates false module-specific badges.
    """
    if _get_cq_alarms is None:
        return {"spc": 0, "envmon": 0, "trace": 0}

    try:
        result = await _get_cq_alarms(user=user)
        counts = {"spc": 0, "envmon": 0, "trace": 0}

        for alarm in result.get("alarms", []):
            if alarm.get("status", "open") != "open":
                continue
            source = alarm.get("source")
            if source in counts:
                counts[source] += 1

        if any(counts.values()):
            return counts

        return {
            module_id: int(result.get(module_id, 0) or result.get(f"{module_id}_open", 0) or 0)
            for module_id in counts
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
    counts.update(await _fetch_cq_counts(user))
    return {k: v for k, v in counts.items() if v > 0}
