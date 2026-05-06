"""ConnectedQuality router import smoke tests."""

from __future__ import annotations

import importlib


def test_connectedquality_routers_import_cleanly() -> None:
    """Ensure all ConnectedQuality router modules remain syntactically importable."""
    modules = [
        "connectedquality_backend.routers.alarms",
        "connectedquality_backend.routers.envmon",
        "connectedquality_backend.routers.lab",
        "connectedquality_backend.routers.spc",
        "connectedquality_backend.routers.trace",
        "connectedquality_backend.user_preferences.router_me",
    ]

    for module_name in modules:
        module = importlib.import_module(module_name)

        assert getattr(module, "router") is not None
