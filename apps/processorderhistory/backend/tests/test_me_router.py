"""Router tests for GET /api/me and _name_from_email helper."""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock

from backend.main import app
import backend.routers.me_router as me_router

client = TestClient(app)


# ---------------------------------------------------------------------------
# _name_from_email
# ---------------------------------------------------------------------------

def test_name_from_email_firstname_lastname():
    name, initials = me_router._name_from_email("alice.smith@example.com")
    assert name == "Alice Smith"
    assert initials == "AS"


def test_name_from_email_single_part():
    name, initials = me_router._name_from_email("john@example.com")
    assert name == "John"
    assert initials == "J"


def test_name_from_email_hyphen_separator():
    name, initials = me_router._name_from_email("alice-smith@example.com")
    assert name == "Alice Smith"
    assert initials == "AS"


def test_name_from_email_empty_local_part():
    _, initials = me_router._name_from_email("@example.com")
    assert initials == "?"


def test_name_from_email_three_parts_initials_uses_first_two():
    _, initials = me_router._name_from_email("alice.marie.smith@example.com")
    assert initials == "AM"


def test_name_from_email_capitalises_parts():
    name, _ = me_router._name_from_email("ALICE.SMITH@example.com")
    assert name == "Alice Smith"


# ---------------------------------------------------------------------------
# GET /api/me
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_me(monkeypatch):
    monkeypatch.setattr(me_router, "resolve_token", lambda *_: "token")
    monkeypatch.setattr(me_router, "check_warehouse_config", lambda: None)
    mock = AsyncMock(return_value=[{"email": "alice.smith@example.com"}])
    monkeypatch.setattr(me_router, "run_sql_async", mock)
    return mock


def test_get_me_returns_200(mock_me):
    response = client.get("/api/me")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Alice Smith"
    assert data["initials"] == "AS"
    assert data["email"] == "alice.smith@example.com"


def test_get_me_returns_all_keys(mock_me):
    response = client.get("/api/me")
    data = response.json()
    for key in ("name", "initials", "email"):
        assert key in data, f"Missing key: {key}"


def test_get_me_handles_empty_sql_result(monkeypatch):
    monkeypatch.setattr(me_router, "resolve_token", lambda *_: "token")
    monkeypatch.setattr(me_router, "check_warehouse_config", lambda: None)
    monkeypatch.setattr(me_router, "run_sql_async", AsyncMock(return_value=[]))
    response = client.get("/api/me")
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == ""
    assert data["initials"] == "?"
