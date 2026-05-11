from __future__ import annotations

from envmon_backend.inspection_analysis import router as inspection_router
from envmon_backend.spatial_config import router as spatial_router

PLATFORM_ROUTERS = [
    (inspection_router, "/api/em", ["EnvMon-Inspection"]),
    (spatial_router, "/api/em", ["EnvMon-Spatial"]),
]
