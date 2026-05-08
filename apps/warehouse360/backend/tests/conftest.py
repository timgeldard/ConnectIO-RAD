import importlib

import pytest


@pytest.fixture(autouse=True)
def bypass_plant_auth(monkeypatch):
    """Bypass assert_plant_authorized for all WH360 unit tests."""
    async def _noop(token, plant_id):
        return

    for mod_path in [
        "warehouse360_backend.inventory_management.application.queries",
        "warehouse360_backend.operations_control_tower.application.queries",
        "warehouse360_backend.order_fulfillment.application.queries",
        "warehouse360_backend.dispensary_ops.application.queries",
    ]:
        mod = importlib.import_module(mod_path)
        monkeypatch.setattr(mod, "assert_plant_authorized", _noop)
