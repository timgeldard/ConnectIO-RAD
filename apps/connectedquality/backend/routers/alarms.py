"""Alarms / cross-module signal inbox stub router.

Replace mock returns with DAL queries once the CQ data layer is wired.
"""

from fastapi import APIRouter

router = APIRouter()


@router.get("/alarms")
async def get_alarms(status: str | None = None, source: str | None = None):
    """Cross-module alarm stream, optionally filtered by status or source module."""
    return {
        "total": 0,
        "open": 0,
        "acknowledged": 0,
        "alarms": [],
    }
