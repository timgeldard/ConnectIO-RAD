"""Domain — dispensary task status derivation rules."""

from __future__ import annotations

from typing import Literal, Optional

TaskStatus = Literal["OPEN", "IN_PROGRESS", "COMPLETED", "OVERDUE"]

_STATUS_MAP: dict[str, TaskStatus] = {
    "OPEN": "OPEN",
    "IN PROGRESS": "IN_PROGRESS",
    "IN_PROGRESS": "IN_PROGRESS",
    "COMPLETED": "COMPLETED",
    "COMPLETE": "COMPLETED",
    "DONE": "COMPLETED",
    "OVERDUE": "OVERDUE",
    "LATE": "OVERDUE",
}

_URGENCY_THRESHOLD_MINS: float = 30.0


def normalize_task_status(raw: Optional[str]) -> TaskStatus:
    """Map a raw SAP task status string to a canonical TaskStatus.

    Unknown or missing values default to ``"OPEN"`` so callers always receive a
    typed value regardless of upstream data quality.

    Args:
        raw: The raw status string from the data warehouse view.

    Returns:
        Canonical ``TaskStatus`` value.
    """
    if raw is None:
        return "OPEN"
    return _STATUS_MAP.get(raw.upper().strip(), "OPEN")


def is_urgent(status: TaskStatus, mins_to_start: Optional[float]) -> bool:
    """Return True when a task needs immediate attention.

    A task is urgent when it is not yet completed AND it starts within the
    urgency threshold (30 minutes), or it is already overdue.

    Args:
        status: The canonical task status.
        mins_to_start: Minutes until the task is scheduled to begin.
            Negative values indicate the task is already past its start time.

    Returns:
        True if the task requires immediate attention.
    """
    if status == "COMPLETED":
        return False
    if status == "OVERDUE":
        return True
    if mins_to_start is None:
        return False
    return mins_to_start <= _URGENCY_THRESHOLD_MINS
