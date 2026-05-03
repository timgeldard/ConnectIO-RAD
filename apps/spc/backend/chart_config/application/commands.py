"""Application command handlers for chart configuration writes."""

from __future__ import annotations

import uuid
import logging
from typing import Any, Optional

from backend.chart_config.dal import exclusions as exclusions_dal
from backend.chart_config.dal import locked_limits as locked_limits_dal
from backend.chart_config.domain.exclusion import Exclusion
from backend.chart_config.domain.locked_limits import LockedLimits

logger = logging.getLogger(__name__)


def build_locked_limits(command: Any) -> LockedLimits:
    """Convert an API command object into the chart_config domain value object."""
    return LockedLimits(
        material_id=command.material_id,
        mic_id=command.mic_id,
        plant_id=command.plant_id,
        operation_id=command.operation_id,
        chart_type=command.chart_type,
        cl=command.cl,
        ucl=command.ucl,
        lcl=command.lcl,
        ucl_r=command.ucl_r,
        lcl_r=command.lcl_r,
        sigma_within=command.sigma_within,
        baseline_from=command.baseline_from,
        baseline_to=command.baseline_to,
        unified_mic_key=command.unified_mic_key,
        mic_origin=command.mic_origin,
        spec_signature=command.spec_signature,
        locking_note=command.locking_note,
    )


async def lock_limits(token: str, command: Any) -> dict:
    limits = build_locked_limits(command)
    return await locked_limits_dal.save_locked_limits(token, limits)


async def delete_limits(token: str, command: Any) -> dict:
    return await locked_limits_dal.delete_locked_limits(
        token,
        command.material_id,
        command.mic_id,
        command.plant_id,
        command.chart_type,
        operation_id=command.operation_id,
        unified_mic_key=command.unified_mic_key,
    )


async def get_limits(
    token: str,
    *,
    material_id: str,
    mic_id: str,
    plant_id: Optional[str],
    chart_type: str,
    operation_id: Optional[str],
    unified_mic_key: Optional[str],
) -> Optional[dict]:
    return await locked_limits_dal.fetch_locked_limits(
        token,
        material_id,
        mic_id,
        plant_id,
        chart_type,
        operation_id=operation_id,
        unified_mic_key=unified_mic_key,
    )


def build_exclusion_payload(command: Any) -> dict:
    """Build the immutable audit payload after enforcing domain invariants."""
    exclusion = Exclusion(
        material_id=command.material_id,
        mic_id=command.mic_id,
        chart_type=command.chart_type,
        justification=command.justification,
        stratify_by=command.stratify_by,
    )
    return {
        "event_id": str(uuid.uuid4()),
        "material_id": exclusion.material_id,
        "mic_id": exclusion.mic_id,
        "mic_name": command.mic_name,
        "operation_id": command.operation_id,
        "plant_id": command.plant_id,
        "stratify_all": command.stratify_all,
        "stratify_by": exclusion.stratify_by,
        "chart_type": exclusion.chart_type,
        "date_from": command.date_from,
        "date_to": command.date_to,
        "rule_set": command.rule_set,
        "justification": exclusion.justification.strip(),
        "action": command.action,
        "excluded_count": len(command.excluded_points),
        "excluded_points": [point.model_dump() for point in command.excluded_points],
        "before_limits": command.before_limits.model_dump() if command.before_limits else None,
        "after_limits": command.after_limits.model_dump() if command.after_limits else None,
    }


async def save_exclusions(token: str, command: Any) -> dict:
    payload = build_exclusion_payload(command)
    await exclusions_dal.save_exclusion_snapshot(token, payload)
    try:
        actor = await exclusions_dal.fetch_actor_metadata(token)
    except RuntimeError as exc:
        logger.warning("exclusions.actor_metadata_lookup_failed: %s", exc)
        actor = {"user_id": None, "event_ts": None}
    return {
        "saved": True,
        "event_id": payload["event_id"],
        "user_id": actor.get("user_id"),
        "event_ts": actor.get("event_ts"),
    }


async def get_exclusions(token: str, query: Any) -> Optional[dict]:
    return await exclusions_dal.fetch_latest_exclusion_snapshot(
        token,
        query.material_id,
        query.mic_id,
        query.chart_type,
        query.operation_id,
        query.plant_id,
        query.stratify_all,
        query.stratify_by,
        query.date_from,
        query.date_to,
    )
