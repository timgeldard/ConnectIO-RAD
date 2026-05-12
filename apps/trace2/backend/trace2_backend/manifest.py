"""
Module manifest for the Traceability 2.0 application.
"""

MANIFEST = {
    "moduleId": "trace2",
    "displayName": "Traceability 2.0",
    "shortName": "TRACE",
    "tagline": "End-to-end product genealogy and tracking",
    "domain": "manufacturing",
    "category": "operations",
    "description": "Full product lifecycle traceability from raw materials to finished goods. Comprehensive recall readiness and genealogy analysis.",
    "icon": "search",
    "color": "#0f62fe",
    "sidebarGroup": "operations",
    "sidebarOrder": 20,
    "routeBase": "/trace/",
    "route": {"kind": "local", "path": "/trace/"},
    "landingCard": {
        "tag": "Genealogy",
        "desc": "Upstream and downstream trace in seconds.",
        "stats": [
            {"value": "100%", "label": "Compliance"},
            {"value": "<2s", "label": "Query Time"},
        ],
    },
}
