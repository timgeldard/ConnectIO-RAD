"""Chart Config — locked limits and exclusion snapshot endpoints."""

import json
import logging
import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ValidationError, field_validator

from backend.chart_config.dal.exclusions import fetch_latest_exclusion_snapshot, save_exclusion_snapshot
from backend.chart_config.dal.locked_limits import delete_locked_limits, fetch_locked_limits, save_locked_limits
from backend.utils.db import (
    check_warehouse_config,
    classify_sql_runtime_error,
    run_sql_async,
)
from shared_db.utils import handle_locked_limits_error
from backend.schemas.spc_schemas import (
    DeleteLockedLimitsRequest,
    GetLockedLimitsRequest,
    LockLimitsRequest,
)
from backend.utils.rate_limit import limiter
from shared_auth import UserIdentity, require_proxy_user

router = APIRouter()
logger = logging.getLogger(__name__)

_CHART_TYPES = {"imr", "xbar_r", "p_chart"}
_STRATIFY_KEYS = {"plant_id", "inspection_lot_id", "operation_id"}


def _handle_exclusion_sql_error(exc: Exception) -> None:
    mapped_error = classify_sql_runtime_error(
        exc,
        missing_table_detail=(
            "Exclusions audit table not initialised. "
            "Run the exclusions migration before using manual point exclusions."
        ),
    )
    if mapped_error is not None:
        raise mapped_error

    error_id = str(uuid.uuid4())
    logger.exception("exclusions.sql_error error_id=%s", error_id, exc_info=exc)
    raise HTTPException(
        status_code=500,
        detail=f"Internal server error; reference id: {error_id}",
    )


# ---------------------------------------------------------------------------
# Locked Limits
# ---------------------------------------------------------------------------

@router.post("/lock-limits")
@limiter.limit("30/minute")
async def lock_limits(
    request: Request,
    body: LockLimitsRequest,
    user: UserIdentity = Depends(require_proxy_user),
):
    """Persist or update locked control limits for the active SPC chart scope."""
    token = user.raw_token
    check_warehouse_config()

    try:
        return await save_locked_limits(
            token,
            body.material_id,
            body.mic_id,
            body.plant_id,
            body.chart_type,
            body.cl,
            body.ucl,
            body.lcl,
            body.ucl_r,
            body.lcl_r,
            body.sigma_within,
            body.baseline_from,
            body.baseline_to,
            operation_id=body.operation_id,
            unified_mic_key=body.unified_mic_key,
            mic_origin=body.mic_origin,
            spec_signature=body.spec_signature,
            locking_note=body.locking_note,
        )
    except Exception as exc:
        handle_locked_limits_error(exc)


@router.get("/locked-limits")
@limiter.limit("120/minute")
async def get_locked_limits(
    request: Request,
    material_id: str,
    mic_id: str,
    user: UserIdentity = Depends(require_proxy_user),
    unified_mic_key: Optional[str] = None,
    plant_id: Optional[str] = None,
    operation_id: Optional[str] = None,
    chart_type: str = "imr",
):
    """Return the most recently locked limits for the given chart scope."""
    token = user.raw_token
    check_warehouse_config()
    try:
        GetLockedLimitsRequest(
            material_id=material_id,
            mic_id=mic_id,
            unified_mic_key=unified_mic_key,
            plant_id=plant_id,
            operation_id=operation_id,
            chart_type=chart_type,
        )
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors()) from exc

    try:
        row = await fetch_locked_limits(
            token,
            material_id,
            mic_id,
            plant_id,
            chart_type,
            operation_id=operation_id,
            unified_mic_key=unified_mic_key,
        )
    except Exception as exc:
        handle_locked_limits_error(exc)

    return {"locked_limits": row}


@router.delete("/locked-limits")
@limiter.limit("30/minute")
async def delete_locked_limits_route(
    request: Request,
    body: DeleteLockedLimitsRequest,
    user: UserIdentity = Depends(require_proxy_user),
):
    """Delete the locked limits for the given chart scope."""
    token = user.raw_token
    check_warehouse_config()
    try:
        return await delete_locked_limits(
            token,
            body.material_id,
            body.mic_id,
            body.plant_id,
            body.chart_type,
            operation_id=body.operation_id,
            unified_mic_key=body.unified_mic_key,
        )
    except Exception as exc:
        handle_locked_limits_error(exc)


# ---------------------------------------------------------------------------
# Exclusions
# ---------------------------------------------------------------------------

class LimitSnapshot(BaseModel):
    cl: Optional[float] = None
    ucl: Optional[float] = None
    lcl: Optional[float] = None
    ucl_r: Optional[float] = None
    lcl_r: Optional[float] = None
    sigma_within: Optional[float] = None
    point_count: Optional[int] = None


class ExcludedPoint(BaseModel):
    batch_id: str
    sample_seq: int
    batch_seq: Optional[int] = None
    batch_date: Optional[str] = None
    plant_id: Optional[str] = None
    stratify_value: Optional[str] = None
    value: Optional[float] = None
    original_index: Optional[int] = None


class SaveExclusionsRequest(BaseModel):
    material_id: str
    mic_id: str
    mic_name: Optional[str] = None
    operation_id: Optional[str] = None
    plant_id: Optional[str] = None
    stratify_all: bool = False
    stratify_by: Optional[str] = None
    chart_type: str = "imr"
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    rule_set: Optional[str] = None
    justification: str
    action: str = "manual_toggle"
    excluded_points: list[ExcludedPoint]
    before_limits: Optional[LimitSnapshot] = None
    after_limits: Optional[LimitSnapshot] = None

    @field_validator("chart_type")
    @classmethod
    def validate_chart_type(cls, value: str) -> str:
        if value not in _CHART_TYPES:
            raise ValueError(f"chart_type must be one of {sorted(_CHART_TYPES)}")
        return value

    @field_validator("stratify_by")
    @classmethod
    def validate_stratify_by(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in _STRATIFY_KEYS:
            raise ValueError(f"stratify_by must be one of {sorted(_STRATIFY_KEYS)}")
        return value

    @field_validator("mic_name", "operation_id", "plant_id", "date_from", "date_to", "rule_set", "stratify_by", mode="before")
    @classmethod
    def normalize_optional_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        return value or None

    @field_validator("justification")
    @classmethod
    def validate_justification(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 3:
            raise ValueError("justification must be at least 3 characters")
        return value


class GetExclusionsQuery(BaseModel):
    material_id: str
    mic_id: str
    chart_type: str = "imr"
    operation_id: Optional[str] = None
    plant_id: Optional[str] = None
    stratify_all: bool = False
    stratify_by: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None

    @field_validator("chart_type")
    @classmethod
    def validate_chart_type(cls, value: str) -> str:
        return SaveExclusionsRequest.validate_chart_type(value)

    @field_validator("stratify_by")
    @classmethod
    def validate_stratify_by(cls, value: Optional[str]) -> Optional[str]:
        return SaveExclusionsRequest.validate_stratify_by(value)

    @field_validator("operation_id", "plant_id", "date_from", "date_to", "stratify_by", mode="before")
    @classmethod
    def normalize_optional_text(cls, value: Optional[str]) -> Optional[str]:
        return SaveExclusionsRequest.normalize_optional_text(value)


@router.post("/exclusions")
@limiter.limit("30/minute")
async def save_exclusions(
    request: Request,
    body: SaveExclusionsRequest,
    user: UserIdentity = Depends(require_proxy_user),
):
    """Persist an immutable exclusions snapshot for the active SPC chart scope."""
    token = user.raw_token
    check_warehouse_config()

    payload = {
        "event_id": str(uuid.uuid4()),
        "material_id": body.material_id,
        "mic_id": body.mic_id,
        "mic_name": body.mic_name,
        "operation_id": body.operation_id,
        "plant_id": body.plant_id,
        "stratify_all": body.stratify_all,
        "stratify_by": body.stratify_by,
        "chart_type": body.chart_type,
        "date_from": body.date_from,
        "date_to": body.date_to,
        "rule_set": body.rule_set,
        "justification": body.justification,
        "action": body.action,
        "excluded_count": len(body.excluded_points),
        "excluded_points": [point.model_dump() for point in body.excluded_points],
        "before_limits": body.before_limits.model_dump() if body.before_limits else None,
        "after_limits": body.after_limits.model_dump() if body.after_limits else None,
    }

    try:
        await save_exclusion_snapshot(token, payload)
    except RuntimeError as exc:
        _handle_exclusion_sql_error(exc)

    try:
        actor_rows = await run_sql_async(
            token,
            "SELECT CURRENT_USER() AS user_id, CAST(CURRENT_TIMESTAMP() AS STRING) AS event_ts",
            endpoint_hint="spc.exclusions.actor-metadata",
        )
    except RuntimeError as exc:
        logger.warning("exclusions.actor_metadata_lookup_failed: %s", exc)
        actor_rows = [{"user_id": None, "event_ts": None}]
    actor = actor_rows[0] if actor_rows else {"user_id": None, "event_ts": None}

    return {
        "saved": True,
        "event_id": payload["event_id"],
        "user_id": actor.get("user_id"),
        "event_ts": actor.get("event_ts"),
    }


@router.get("/exclusions")
@limiter.limit("60/minute")
async def fetch_exclusions(
    request: Request,
    query: Annotated[GetExclusionsQuery, Depends()],
    user: UserIdentity = Depends(require_proxy_user),
):
    """Return the latest exclusions snapshot for the active SPC chart scope."""
    token = user.raw_token
    check_warehouse_config()

    try:
        row = await fetch_latest_exclusion_snapshot(
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
    except RuntimeError as exc:
        _handle_exclusion_sql_error(exc)

    if row is None:
        return {"exclusions": None}
    return {"exclusions": row}
