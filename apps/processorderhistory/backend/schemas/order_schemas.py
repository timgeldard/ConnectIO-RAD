"""Pydantic request/response schemas for the orders endpoints."""
from typing import Optional

from pydantic import BaseModel, field_validator


class OrderListRequest(BaseModel):
    """POST /api/orders request body."""

    plant_id: Optional[str] = None
    limit: int = 2000

    @field_validator("limit")
    @classmethod
    def clamp_limit(cls, v: int) -> int:
        """Guard against excessively large fetches."""
        return max(1, min(v, 5000))
