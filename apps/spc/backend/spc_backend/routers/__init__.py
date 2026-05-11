from spc_backend.process_control.router_metadata import router as metadata_router
from spc_backend.process_control.router_charts import router as charts_router
from spc_backend.process_control.router_analysis import router as analysis_router
from spc_backend.routers.export import router as export_router
from spc_backend.chart_config.router import router as chart_config_router
from spc_backend.routers.genie import router as genie_router

PLATFORM_ROUTERS = [
    (metadata_router, "/api/spc", ["SPC"]),
    (charts_router, "/api/spc", ["SPC"]),
    (analysis_router, "/api/spc", ["SPC"]),
    (export_router, "/api/spc", ["SPC-Export"]),
    (chart_config_router, "/api/spc", ["SPC-ChartConfig"]),
    (genie_router, "/api/spc", ["SPC-Genie"]),
]
