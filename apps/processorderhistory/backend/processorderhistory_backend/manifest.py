"""
Module manifest for the Process Order History application.
"""

MANIFEST = {
    "moduleId": "processorderhistory",
    "displayName": "Process Order History",
    "shortName": "POH",
    "tagline": "Historical performance of manufacturing orders",
    "domain": "manufacturing",
    "category": "operations",
    "description": "Analyze past process orders, batch performance, and production variances to drive continuous improvement.",
    "icon": "list",
    "color": "#da1e28",
    "sidebarGroup": "operations",
    "sidebarOrder": 40,
    "routeBase": "/poh/",
    "route": {"kind": "local", "path": "/poh/"},
    "landingCard": {
        "tag": "Order History",
        "desc": "Deep dive into historical batch performance.",
        "stats": [
            {"value": "5.2k", "label": "Orders"},
            {"value": "15%", "label": "Efficiency Gain"},
        ],
    },
}
