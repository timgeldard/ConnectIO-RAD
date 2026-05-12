from __future__ import annotations

from warehouse360_backend.order_fulfillment.router_process_orders import router as process_orders_router
from warehouse360_backend.order_fulfillment.router_deliveries import router as deliveries_router
from warehouse360_backend.inventory_management.router_inbound import router as inbound_router
from warehouse360_backend.inventory_management.router_inventory import router as inventory_router
from warehouse360_backend.dispensary_ops.router_dispensary import router as dispensary_router
from warehouse360_backend.operations_control_tower.router_kpis import router as kpis_router
from warehouse360_backend.inventory_management.router_plants import router as plants_router
from warehouse360_backend.inventory_management.router_imwm import router as imwm_router

PLATFORM_ROUTERS = [
    (process_orders_router, "/api/wh", ["W360-ProcessOrders"]),
    (deliveries_router, "/api/wh", ["W360-Deliveries"]),
    (inbound_router, "/api/wh", ["W360-Inbound"]),
    (inventory_router, "/api/wh", ["W360-Inventory"]),
    (dispensary_router, "/api/wh", ["W360-Dispensary"]),
    (kpis_router, "/api/wh", ["W360-KPIs"]),
    (plants_router, "/api/wh", ["W360-Plants"]),
    (imwm_router, "/api/wh", ["W360-IMWM"]),
]
