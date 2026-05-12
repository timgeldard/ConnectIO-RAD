from __future__ import annotations

from processorderhistory_backend.order_execution.router_me import router as me_router
from processorderhistory_backend.order_execution.router_orders import router as orders_router
from processorderhistory_backend.order_execution.router_order_detail import router as order_detail_router
from processorderhistory_backend.order_execution.router_pours import router as pours_router
from processorderhistory_backend.production_planning.router_planning import router as planning_router
from processorderhistory_backend.order_execution.router_day_view import router as day_view_router
from processorderhistory_backend.order_execution.router_lineside_monitor import router as lineside_monitor_router
from processorderhistory_backend.routers.plants_router import router as plants_router
from processorderhistory_backend.manufacturing_analytics.router_yield import router as yield_router
from processorderhistory_backend.manufacturing_analytics.router_quality import router as quality_router
from processorderhistory_backend.manufacturing_analytics.router_downtime import router as downtime_router
from processorderhistory_backend.manufacturing_analytics.router_oee import router as oee_router
from processorderhistory_backend.manufacturing_analytics.router_adherence import router as adherence_router
from processorderhistory_backend.genie_assist.router_genie import router as genie_router
from processorderhistory_backend.production_planning.router_vessel_planning import router as vessel_planning_router
from processorderhistory_backend.manufacturing_analytics.router_equipment_insights import router as equipment_insights_router
from processorderhistory_backend.manufacturing_analytics.router_equipment_insights2 import router as equipment_insights2_router

PLATFORM_ROUTERS = [
    (me_router, "/api", None),
    (orders_router, "/api", None),
    (order_detail_router, "/api", None),
    (pours_router, "/api", None),
    (planning_router, "/api", None),
    (day_view_router, "/api", None),
    (lineside_monitor_router, "/api", None),
    (plants_router, "/api", None),
    (yield_router, "/api", None),
    (quality_router, "/api", None),
    (downtime_router, "/api", None),
    (oee_router, "/api", None),
    (adherence_router, "/api", None),
    (genie_router, "/api", None),
    (vessel_planning_router, "/api", None),
    (equipment_insights_router, "/api", None),
    (equipment_insights2_router, "/api", None),
]
