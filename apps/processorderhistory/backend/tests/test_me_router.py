"""Router tests for GET /api/me and _name_from_email helper."""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock

from backend.main import app
import backend.order_execution.router_me as me_router

client = TestClient(app)


# ---------------------------------------------------------------------------
# _name_from_email
# ---------------------------------------------------------------------------

def test_name_from_email_firstname_lastname():
    """Extract name and initials from a standard dotted email address."""
    name, initials = me_router._name_from_email("alice.smith@example.com")
    assert name == "Alice Smith"
    assert initials == "AS"


def test_name_from_email_single_part():
    """Extract name and initials from a single-part local email address."""
    name, initials = me_router._name_from_email("john@example.com")
    assert name == "John"
    assert initials == "J"


def test_name_from_email_hyphen_separator():
    """Extract name and initials from a hyphenated email address."""
    name, initials = me_router._name_from_email("alice-smith@example.com")
    assert name == "Alice Smith"
    assert initials == "AS"


def test_name_from_email_empty_local_part():
    """Handle empty local part by returning a placeholder initial."""
    _, initials = me_router._name_from_email("@example.com")
    assert initials == "?"


def test_name_from_email_three_parts_initials_uses_first_two():
    """Use only the first two parts for initials in a multi-part email."""
    _, initials = me_router._name_from_email("alice.marie.smith@example.com")
    assert initials == "AM"


def test_name_from_email_capitalises_parts():
    """Ensure name parts are capitalised regardless of input case."""
    name, _ = me_router._name_from_email("ALICE.SMITH@example.com")
    assert name == "Alice Smith"


# ---------------------------------------------------------------------------
# GET /api/me
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_me(monkeypatch):
    """Fixture to mock the database and token resolution for /api/me."""
    monkeypatch.setattr(me_router, "check_warehouse_config", lambda: None)
    mock = AsyncMock(return_value="alice.smith@example.com")
    monkeypatch.setattr(me_router, "get_user_email", mock)
    return mock


def test_get_me_returns_200(mock_me):
    """Verify that /api/me returns a 200 status and correctly parsed user data."""
    response = client.get("/api/me")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Alice Smith"
    assert data["initials"] == "AS"
    assert data["email"] == "alice.smith@example.com"


def test_get_me_returns_all_keys(mock_me):
    """Ensure the /api/me response contains all required keys."""
    response = client.get("/api/me")
    data = response.json()
    for key in ("name", "initials", "email"):
        assert key in data, f"Missing key: {key}"


def test_get_me_handles_empty_sql_result(monkeypatch):
    """Verify that /api/me gracefully handles cases where no user record is found."""
    monkeypatch.setattr(me_router, "check_warehouse_config", lambda: None)
    monkeypatch.setattr(me_router, "get_user_email", AsyncMock(return_value=""))
    response = client.get("/api/me")
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == ""
    assert data["initials"] == "?"
