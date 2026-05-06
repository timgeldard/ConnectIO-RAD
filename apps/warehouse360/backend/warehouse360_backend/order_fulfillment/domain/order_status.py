"""Domain — process order status normalisation rules."""

from __future__ import annotations

from typing import Literal, Optional

ProcessOrderStatus = Literal["CREATED", "RELEASED", "IN_PROGRESS", "COMPLETED", "CLOSED"]

_STATUS_MAP: dict[str, ProcessOrderStatus] = {
    "CREATED": "CREATED",
    "NEW": "CREATED",
    "PLANNED": "CREATED",
    "RELEASED": "RELEASED",
    "REL": "RELEASED",
    "PARTIALLY RELEASED": "RELEASED",
    "PARTIALLY_RELEASED": "RELEASED",
    "IN PROGRESS": "IN_PROGRESS",
    "IN_PROGRESS": "IN_PROGRESS",
    "ACTIVE": "IN_PROGRESS",
    "PARTIALLY CONFIRMED": "IN_PROGRESS",
    "PARTIALLY_CONFIRMED": "IN_PROGRESS",
    "COMPLETED": "COMPLETED",
    "CONFIRMED": "COMPLETED",
    "PARTIALLY DELIVERED": "COMPLETED",
    "PARTIALLY_DELIVERED": "COMPLETED",
    "CLOSED": "CLOSED",
    "TECHNICALLY COMPLETED": "CLOSED",
    "TECHNICALLY_COMPLETED": "CLOSED",
    "TECO": "CLOSED",
}

_OPEN_STATUSES: frozenset[ProcessOrderStatus] = frozenset({"CREATED", "RELEASED", "IN_PROGRESS"})


def normalize_po_status(raw: Optional[str]) -> ProcessOrderStatus:
    """Map a raw SAP process order status string to a canonical ProcessOrderStatus.

    Unknown or missing values default to ``"CREATED"``.

    Args:
        raw: The raw status string from the data warehouse view.

    Returns:
        Canonical ``ProcessOrderStatus`` value.
    """
    if raw is None:
        return "CREATED"
    return _STATUS_MAP.get(raw.upper().strip(), "CREATED")


def is_open_order(status: ProcessOrderStatus) -> bool:
    """Return True for orders that are still in active production.

    CREATED, RELEASED, and IN_PROGRESS orders are open — they have not yet
    been completed or technically closed in SAP.

    Args:
        status: The canonical process order status.

    Returns:
        True if the order is still active.
    """
    return status in _OPEN_STATUSES
