import pytest
from shared_auth import require_user, UserIdentity
from backend.main import app

@pytest.fixture(autouse=True)
def mock_require_user():
    """Mock require_user dependency for all POH tests."""
    async def mock_user():
        return UserIdentity(user_id="test-user", raw_token="token")
    
    app.dependency_overrides[require_user] = mock_user
    yield
    app.dependency_overrides.clear()
