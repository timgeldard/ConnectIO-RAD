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
    (me_router, "/api/poh", None),
    (orders_router, "/api/poh", None),
    (order_detail_router, "/api/poh", None),
    (pours_router, "/api/poh", None),
    (planning_router, "/api/poh", None),
    (day_view_router, "/api/poh", None),
    (lineside_monitor_router, "/api/poh", None),
    (plants_router, "/api/poh", None),
    (plants_router, "/api", None),
    (yield_router, "/api/poh", None),
    (quality_router, "/api/poh", None),
    (downtime_router, "/api/poh", None),
    (oee_router, "/api/poh", None),
    (adherence_router, "/api/poh", None),
    (genie_router, "/api/poh", None),
    (vessel_planning_router, "/api/poh", None),
    (equipment_insights_router, "/api/poh", None),
    (equipment_insights2_router, "/api/poh", None),
]
