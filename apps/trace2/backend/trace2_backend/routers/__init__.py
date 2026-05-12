from __future__ import annotations

from trace2_backend.batch_trace import router as batch_router
from trace2_backend.genie_assist.router_genie import router as genie_router
from trace2_backend.lineage_analysis import router as lineage_router
from trace2_backend.quality_record import router as quality_router

PLATFORM_ROUTERS = [
    (batch_router, "/api", ["Trace-Batch"]),
    (lineage_router, "/api", ["Trace-Lineage"]),
    (quality_router, "/api", ["Trace-Quality"]),
    # Mounted at /api (not /api/t2) so the platform shell's existing
    # module-id-aware Genie client can route /api/genie/* to whichever
    # space matches the active module — same convention POH and SPC
    # already follow.  Genie endpoint paths are identical; the platform
    # picks the correct space per module via its frontend api client.
    (genie_router, "/api", ["Trace-Genie"]),
]
