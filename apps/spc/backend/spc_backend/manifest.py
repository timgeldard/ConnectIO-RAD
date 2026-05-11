"""SPC module manifest for platform integration."""

MANIFEST = {
    "moduleId": "spc",
    "displayName": "Statistical Process Control",
    "shortName": "SPC",
    "tagline": "Real-time process capability and control charts.",
    "domain": "manufacturing",
    "category": "quality",
    "description": "Monitor and analyze manufacturing process stability using Nelson rules and capability indices.",
    "icon": "chart",
    "color": "#289BA2",
    "sidebarGroup": "quality",
    "sidebarOrder": 10,
    "routeBase": "/spc/",
    "route": {
        "kind": "local",
        "path": "/spc/"
    },
    "landingCard": {
        "tag": "SPC · Quality Control",
        "desc": "Statistical Process Control for manufacturing lines.",
        "stats": [
            {"value": "12", "label": "Active Charts"},
            {"value": "3", "label": "Violations", "tone": "warn"}
        ]
    }
}
