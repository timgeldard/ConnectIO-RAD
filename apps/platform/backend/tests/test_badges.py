import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from fastapi import FastAPI
from backend.routes.badges import router
from shared_auth.identity import UserIdentity

@pytest.fixture
def app():
    _app = FastAPI()
    _app.include_router(router)
    return _app

@pytest.fixture
def client(app):
    return TestClient(app)

@pytest.fixture
def mock_user():
    return UserIdentity(user_id="test-user", email="test@example.com")

def test_get_badge_counts_unauthenticated(client):
    """Should return 401/403 if no proxy headers are present."""
    response = client.get("/api/badges")
    assert response.status_code in (401, 403)

@patch("backend.routes.badges.require_proxy_user")
@patch("backend.routes.badges._get_cq_alarms")
async def test_get_badge_counts_success(mock_alarms, mock_require_user, app, mock_user):
    """Should return filtered badge counts when authenticated."""
    mock_require_user.return_value = mock_user
    mock_alarms.return_value = {"open": 5}
    
    # We need to use the actual app and override the dependency
    app.dependency_overrides[require_proxy_user] = lambda: mock_user
    
    with TestClient(app) as client:
        response = client.get("/api/badges")
        assert response.status_code == 200
        data = response.json()
        assert data["spc"] == 5
        assert data["envmon"] == 5
        assert data["trace"] == 5
    
    app.dependency_overrides.clear()

@patch("backend.routes.badges.require_proxy_user")
@patch("backend.routes.badges._get_cq_alarms")
async def test_get_badge_counts_filtering(mock_alarms, mock_require_user, app, mock_user):
    """Should omit zero-valued counts."""
    mock_require_user.return_value = mock_user
    mock_alarms.return_value = {"open": 0}
    
    app.dependency_overrides[require_proxy_user] = lambda: mock_user
    
    with TestClient(app) as client:
        response = client.get("/api/badges")
        assert response.status_code == 200
        assert response.json() == {}
    
    app.dependency_overrides.clear()

@patch("backend.routes.badges.require_proxy_user")
@patch("backend.routes.badges._get_cq_alarms")
async def test_get_badge_counts_error_handling(mock_alarms, mock_require_user, app, mock_user):
    """Should handle sub-backend errors gracefully and return empty counts."""
    mock_require_user.return_value = mock_user
    mock_alarms.side_effect = Exception("Sub-backend down")
    
    app.dependency_overrides[require_proxy_user] = lambda: mock_user
    
    with TestClient(app) as client:
        response = client.get("/api/badges")
        assert response.status_code == 200
        assert response.json() == {}
    
    app.dependency_overrides.clear()
