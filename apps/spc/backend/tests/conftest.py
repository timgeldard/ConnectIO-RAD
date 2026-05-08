import importlib
import pytest
from unittest.mock import AsyncMock
from shared_auth import require_proxy_user, require_user, UserIdentity
from spc_backend.main import app

@pytest.fixture(autouse=True)
def mock_auth_users():
    """Mock auth dependencies for all tests."""
    previous = app.dependency_overrides.get(require_proxy_user)
    previous_require_user = app.dependency_overrides.get(require_user)
    
    app.dependency_overrides[require_proxy_user] = lambda: UserIdentity(user_id="test-user", raw_token="fake-token")
    app.dependency_overrides[require_user] = lambda: UserIdentity(user_id="test-user", raw_token="fake-token")
    yield
    
    if previous is None:
        app.dependency_overrides.pop(require_proxy_user, None)
    else:
        app.dependency_overrides[require_proxy_user] = previous
    if previous_require_user is None:
        app.dependency_overrides.pop(require_user, None)
    else:
        app.dependency_overrides[require_user] = previous_require_user

@pytest.fixture(autouse=True)
def bypass_plant_auth(monkeypatch):
    """Bypass assert_plant_authorized for all SPC unit tests.

    Patches the single definition in dal.authorized_scope plus all application
    modules that import it, so the mock takes effect regardless of which module
    is exercised by a given test.
    """
    async def _noop(token, plant_id):
        return
    for mod_path in [
        "spc_backend.process_control.application.metadata",
        "spc_backend.process_control.application.charts",
        "spc_backend.process_control.application.analysis",
    ]:
        mod = importlib.import_module(mod_path)
        monkeypatch.setattr(mod, "assert_plant_authorized", _noop)


@pytest.fixture
def mock_run_sql_async(monkeypatch):
    """Fixture to mock run_sql_async globally for a test."""
    mock = AsyncMock(return_value=[])
    # We will need to apply this monkeypatch in the actual test or a more specific fixture
    # as we don't know which module to patch here (it's often imported into the DAL)
    return mock

@pytest.fixture
def sample_spc_data():
    """Returns a sample set of SPC measurement data for testing calculations."""
    return [10.5, 10.2, 11.0, 10.8, 10.5, 10.3, 11.2, 10.9, 10.6, 10.4]

@pytest.fixture
def mock_oidc_token():
    """Returns a fake OIDC token for testing router dependencies."""
    return "fake-oidc-token-123"

@pytest.fixture
def subgrouped_sample_data():
    """Returns sample data grouped into subgroups of size 2."""
    return [
        [10.5, 10.2],
        [11.0, 10.8],
        [10.5, 10.3],
        [11.2, 10.9],
        [10.6, 10.4]
    ]
