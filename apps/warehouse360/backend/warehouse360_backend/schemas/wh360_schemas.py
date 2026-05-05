"""
wh360 Pydantic schemas.

All endpoints are GET with path parameters; FastAPI resolves those directly as
function arguments so no request-body models are needed.  This module exists as
the standard location for any output schemas or path-param validators that may
be added in future.
"""

from pydantic import BaseModel


class OrderIdPath(BaseModel):
    """Validated path parameter for process-order detail endpoints."""
    order_id: str


class DeliveryIdPath(BaseModel):
    """Validated path parameter for delivery detail endpoints."""
    delivery_id: str


class PoIdPath(BaseModel):
    """Validated path parameter for inbound receipt detail endpoints."""
    po_id: str
