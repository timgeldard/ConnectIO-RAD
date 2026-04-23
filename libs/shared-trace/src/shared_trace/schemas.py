from __future__ import annotations

from pydantic import BaseModel, field_validator

MATERIAL_ID_MAX_LEN = 40
BATCH_ID_MAX_LEN = 80


def validate_identifier(value: str, field_name: str, max_len: int) -> str:
    trimmed = value.strip()
    if not trimmed:
        raise ValueError(f"{field_name} must not be blank")
    if len(trimmed) > max_len:
        raise ValueError(f"{field_name} must be at most {max_len} characters")
    return trimmed


class _BatchRequest(BaseModel):
    batch_id: str

    @field_validator("batch_id")
    @classmethod
    def check_batch_id(cls, value: str) -> str:
        return validate_identifier(value, "batch_id", BATCH_ID_MAX_LEN)


class _MaterialBatchRequest(_BatchRequest):
    material_id: str

    @field_validator("material_id")
    @classmethod
    def check_material_id(cls, value: str) -> str:
        return validate_identifier(value, "material_id", MATERIAL_ID_MAX_LEN)


class TraceRequest(_MaterialBatchRequest):
    pass


class SummaryRequest(_BatchRequest):
    pass


class ImpactRequest(_BatchRequest):
    pass


class BatchDetailsRequest(_MaterialBatchRequest):
    pass


class RecallReadinessRequest(_MaterialBatchRequest):
    pass


class BatchPageRequest(_MaterialBatchRequest):
    pass
