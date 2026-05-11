from __future__ import annotations

from trace2_backend.batch_trace import router as batch_router
from trace2_backend.lineage_analysis import router as lineage_router
from trace2_backend.quality_record import router as quality_router

PLATFORM_ROUTERS = [
    (batch_router, "/api", ["Trace-Batch"]),
    (lineage_router, "/api", ["Trace-Lineage"]),
    (quality_router, "/api", ["Trace-Quality"]),
]
