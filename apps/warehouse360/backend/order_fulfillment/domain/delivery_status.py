"""Domain — outbound delivery status normalisation rules."""

from __future__ import annotations

from typing import Literal, Optional

DeliveryStatus = Literal["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]

_STATUS_MAP: dict[str, DeliveryStatus] = {
    "PENDING": "PENDING",
    "OPEN": "PENDING",
    "CREATED": "PENDING",
    "PROCESSING": "PROCESSING",
    "PICKING": "PROCESSING",
    "PACKING": "PROCESSING",
    "PACKED": "PROCESSING",
    "SHIPPED": "SHIPPED",
    "IN TRANSIT": "SHIPPED",
    "IN_TRANSIT": "SHIPPED",
    "DISPATCHED": "SHIPPED",
    "DELIVERED": "DELIVERED",
    "GOODS ISSUED": "DELIVERED",
    "GOODS_ISSUED": "DELIVERED",
    "CANCELLED": "CANCELLED",
    "CANCELED": "CANCELLED",
    "REVERSED": "CANCELLED",
}

_ACTIVE_STATUSES: frozenset[DeliveryStatus] = frozenset({"PENDING", "PROCESSING"})


def normalize_delivery_status(raw: Optional[str]) -> DeliveryStatus:
    """Map a raw SAP delivery status string to a canonical DeliveryStatus.

    Unknown or missing values default to ``"PENDING"``.

    Args:
        raw: The raw status string from the data warehouse view.

    Returns:
        Canonical ``DeliveryStatus`` value.
    """
    if raw is None:
        return "PENDING"
    return _STATUS_MAP.get(raw.upper().strip(), "PENDING")


def is_active_delivery(status: DeliveryStatus) -> bool:
    """Return True for deliveries that are in progress and still on-site.

    PENDING and PROCESSING deliveries are considered active (not yet dispatched
    and requiring warehouse attention).

    Args:
        status: The canonical delivery status.

    Returns:
        True if the delivery requires warehouse attention.
    """
    return status in _ACTIVE_STATUSES
