"""Unit tests for shared_api middleware trust-boundary handling."""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from shared_api.middleware import RequestContextMiddleware


def _make_app(*, trust_forwarded_user: bool) -> FastAPI:
    """Create a tiny app that exposes request context state for assertions."""
    app = FastAPI()
    app.add_middleware(RequestContextMiddleware, trust_forwarded_user=trust_forwarded_user)

    @app.get("/context")
    async def context(request: Request):
        return {
            "request_id": request.state.request_id,
            "user_email": request.state.user_email,
        }

    return app


def test_request_context_preserves_safe_request_id_and_forwarded_user() -> None:
    """Trusted, well-formed forwarded metadata is preserved in request state."""
    client = TestClient(_make_app(trust_forwarded_user=True))

    response = client.get(
        "/context",
        headers={
            "x-request-id": "trace-123_ABC",
            "x-forwarded-preferred-username": "qa.user@example.com",
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "request_id": "trace-123_ABC",
        "user_email": "qa.user@example.com",
    }
    assert response.headers["x-request-id"] == "trace-123_ABC"


def test_request_context_regenerates_invalid_request_id() -> None:
    """Unsafe request IDs are replaced so logs and headers stay well formed."""
    client = TestClient(_make_app(trust_forwarded_user=False))

    response = client.get("/context", headers={"x-request-id": "bad\nrequest-id"})

    assert response.status_code == 200
    generated_id = response.json()["request_id"]
    assert generated_id == response.headers["x-request-id"]
    assert generated_id != "bad\nrequest-id"
    assert len(generated_id) == 36


def test_request_context_drops_invalid_forwarded_user(caplog) -> None:
    """Forwarded usernames with control chars are rejected as ambiguous audit data."""
    client = TestClient(_make_app(trust_forwarded_user=True))

    with caplog.at_level("WARNING", logger="shared_api.middleware"):
        response = client.get(
            "/context",
            headers={"x-forwarded-preferred-username": "ops@example.com\tadmin"},
        )

    assert response.status_code == 200
    assert response.json()["user_email"] == "anonymous"
    assert any("invalid_forwarded_user" in record.message for record in caplog.records)
