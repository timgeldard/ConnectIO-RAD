from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.routes.session import require_proxy_user, router
from shared_auth.identity import UserIdentity


def test_platform_session_returns_shell_owned_identity():
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[require_proxy_user] = lambda: UserIdentity(
        user_id="user-123",
        email="operator@example.com",
        display_name="Ops Lead",
        groups=["quality", "warehouse"],
    )

    response = TestClient(app).get("/api/platform/me")

    assert response.status_code == 200
    assert response.json() == {
        "userId": "user-123",
        "email": "operator@example.com",
        "name": "Ops Lead",
        "groups": ["quality", "warehouse"],
    }
