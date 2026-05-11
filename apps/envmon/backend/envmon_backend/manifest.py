"""
Module manifest for the Environmental Monitoring application.
"""

MANIFEST = {
    "moduleId": "envmon",
    "displayName": "Environmental Monitoring",
    "shortName": "ENVMON",
    "tagline": "Facilities and cleanroom environmental tracking",
    "domain": "manufacturing",
    "category": "quality",
    "description": "Monitor temperature, humidity, and particle counts across controlled environments with interactive heatmaps and spatial analysis.",
    "icon": "zap",
    "color": "#8a3ffc",
    "sidebarGroup": "quality",
    "sidebarOrder": 30,
    "routeBase": "/envmon/",
    "route": {"kind": "local", "path": "/envmon/"},
    "landingCard": {
        "tag": "Facilities",
        "desc": "Critical environment monitoring and alerting.",
        "stats": [
            {"value": "24/7", "label": "Uptime"},
            {"value": "0", "label": "Excursions"},
        ],
    },
}
