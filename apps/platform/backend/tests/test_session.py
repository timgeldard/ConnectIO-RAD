"""Tests for the platform session endpoint (GET /api/platform/me)."""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.routes.session import _first_name, require_proxy_user, router
from shared_auth.identity import UserIdentity


def test_platform_session_returns_first_name_from_display_name():
    """Full display name is trimmed to first word."""
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
    data = response.json()
    assert data["name"] == "Ops"
    assert data["email"] == "operator@example.com"
    assert data["userId"] == "user-123"


def test_platform_session_falls_back_to_email_local_part():
    """When display_name is absent, first segment of email local part is used."""
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[require_proxy_user] = lambda: UserIdentity(
        user_id="user-456",
        email="tim.geldard@kerry.com",
        display_name=None,
        groups=[],
    )

    response = TestClient(app).get("/api/platform/me")

    assert response.status_code == 200
    assert response.json()["name"] == "Tim"


@pytest.mark.parametrize("display_name,email,expected", [
    ("Tim Geldard", "tim@example.com", "Tim"),       # display name preferred
    ("Alice", "alice@example.com", "Alice"),          # single-word display name
    (None, "tim.geldard@kerry.com", "Tim"),           # email fallback
    (None, "jane@example.com", "Jane"),               # email no dots
    (None, None, "there"),                            # nothing available
    ("tim@example.com", None, "Tim"),                 # display_name is an email
])
def test_first_name_derivation(display_name, email, expected):
    """_first_name covers all fallback cases."""
    assert _first_name(display_name, email) == expected
