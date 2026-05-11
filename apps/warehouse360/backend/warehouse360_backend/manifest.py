"""
Module manifest for the Warehouse 360 application.
"""

MANIFEST = {
    "moduleId": "warehouse360",
    "displayName": "Warehouse 360",
    "shortName": "W360",
    "tagline": "Real-time inventory and warehouse visibility",
    "domain": "supply-chain",
    "category": "inventory",
    "description": "Holistic view of warehouse operations, stock levels, and material movements across the entire network.",
    "icon": "box",
    "color": "#198038",
    "sidebarGroup": "inventory",
    "sidebarOrder": 50,
    "routeBase": "/w360/",
    "route": {"kind": "local", "path": "/w360/"},
    "landingCard": {
        "tag": "Inventory",
        "desc": "Real-time stock visibility across all locations.",
        "stats": [
            {"value": "98%", "label": "Accuracy"},
            {"value": "45m", "label": "Avg Pick Time"},
        ],
    },
}
