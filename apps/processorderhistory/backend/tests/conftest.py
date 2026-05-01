import pytest
from shared_auth import require_proxy_user, UserIdentity
from backend.main import app

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

