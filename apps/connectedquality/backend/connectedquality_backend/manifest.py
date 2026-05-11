"""
Module manifest for the Connected Quality application.
"""

MANIFEST = {
    "moduleId": "connectedquality",
    "displayName": "Connected Quality",
    "shortName": "CQ",
    "tagline": "Real-time quality monitoring and analytics",
    "domain": "manufacturing",
    "category": "quality",
    "description": "Monitor production quality metrics, track non-conformances, and analyze process capability in real-time across the enterprise.",
    "icon": "chart",
    "color": "#005d5d",
    "sidebarGroup": "quality",
    "sidebarOrder": 10,
    "routeBase": "/cq/",
    "route": {"kind": "local", "path": "/cq/"},
    "landingCard": {
        "tag": "Quality Monitoring",
        "desc": "Integrated quality metrics and process control.",
        "stats": [
            {"value": "99.2%", "label": "Yield"},
            {"value": "12", "label": "Active OOC"},
        ],
    },
}
