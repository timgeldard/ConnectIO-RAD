from __future__ import annotations

from connectedquality_backend.routers.lab import router as lab_router
from connectedquality_backend.user_preferences.router_me import router as me_router
from connectedquality_backend.routers.alarms import router as alarms_router

PLATFORM_ROUTERS = [
    (lab_router, "/api/cq", ["CQ-Lab"]),
    (me_router, "/api/cq", ["CQ-Me"]),
    (alarms_router, "/api/cq", ["CQ-Alarms"]),
]
