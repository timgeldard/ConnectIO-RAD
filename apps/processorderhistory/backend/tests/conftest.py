import importlib

import pytest
from shared_auth import require_proxy_user, UserIdentity
from processorderhistory_backend.main import app

@pytest.fixture(autouse=True)
def mock_require_user():
    """Mock require_proxy_user dependency for all POH tests."""
    previous = app.dependency_overrides.get(require_proxy_user)

    async def mock_user():
        return UserIdentity(user_id="test-user", raw_token="token")

    app.dependency_overrides[require_proxy_user] = mock_user
    yield
    if previous is None:
        app.dependency_overrides.pop(require_proxy_user, None)
    else:
        app.dependency_overrides[require_proxy_user] = previous


@pytest.fixture(autouse=True)
def bypass_plant_auth(monkeypatch):
    """Bypass assert_plant_authorized for all POH unit tests."""
    async def _noop(token, plant_id):
        return

    for mod_path in [
        "processorderhistory_backend.manufacturing_analytics.application.queries",
        "processorderhistory_backend.order_execution.application.queries",
        "processorderhistory_backend.production_planning.application.queries",
    ]:
        mod = importlib.import_module(mod_path)
        monkeypatch.setattr(mod, "assert_plant_authorized", _noop)

