"""Pydantic request/response schemas for the orders endpoints."""
import re
from typing import Optional

from pydantic import BaseModel, field_validator, model_validator

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class OrderListRequest(BaseModel):
    """POST /api/orders request body."""

    plant_id: Optional[str] = None
    limit: int = 2000

    @field_validator("limit")
    @classmethod
    def clamp_limit(cls, v: int) -> int:
        """Guard against excessively large fetches."""
        return max(1, min(v, 5000))


class AnalyticsRequest(BaseModel):
    """Shared request body for analytics endpoints (yield, adherence, downtime, OEE)."""

    plant_id: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    timezone: Optional[str] = None

    @field_validator("date_from")
    @classmethod
    def check_date_from(cls, v: Optional[str]) -> Optional[str]:
        """Reject non-ISO date strings before they reach the DAL."""
        if v is not None and not _DATE_RE.match(v):
            raise ValueError("date_from must be in YYYY-MM-DD format")
        return v

    @field_validator("date_to")
    @classmethod
    def check_date_to(cls, v: Optional[str]) -> Optional[str]:
        """Reject non-ISO date strings before they reach the DAL."""
        if v is not None and not _DATE_RE.match(v):
            raise ValueError("date_to must be in YYYY-MM-DD format")
        return v

    @model_validator(mode="after")
    def check_date_range(self) -> "AnalyticsRequest":
        """Ensure date_from is not after date_to when both are supplied."""
        if self.date_from and self.date_to and self.date_from > self.date_to:
            raise ValueError("date_from must not be after date_to")
        return self
