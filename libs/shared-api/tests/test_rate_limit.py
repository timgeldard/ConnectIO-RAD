"""Unit tests for shared_api.rate_limit."""

from __future__ import annotations

import pytest
from fastapi import Request

from shared_api.rate_limit import RateLimitExceeded, _Limiter, _extract_client_identity


def _request(headers: dict[str, str], client_host: str = "127.0.0.1") -> Request:
    """Build a minimal Starlette request with deterministic headers."""
    scope = {
        "type": "http",
        "headers": [
            (key.lower().encode("latin-1"), value.encode("latin-1"))
            for key, value in headers.items()
        ],
        "client": (client_host, 12345),
    }
    return Request(scope)


def test_extract_client_identity_hashes_token_without_leaking_it() -> None:
    """Rate-limit identity must not expose raw token contents in bucket keys."""
    identity = _extract_client_identity(
        _request({"x-forwarded-access-token": "header.payload.signature"})
    )

    assert identity.startswith("token:")
    assert "payload" not in identity
    assert len(identity) == len("token:") + 64


def test_limiter_blocks_after_threshold() -> None:
    """A client that exceeds its configured budget gets a rate-limit exception."""
    limiter = _Limiter(default_limit="1/minute")

    limiter.check("/api/test", "client-1", None)

    with pytest.raises(RateLimitExceeded):
        limiter.check("/api/test", "client-1", None)


def test_limiter_isolates_clients_by_bucket() -> None:
    """One noisy client must not consume another client's quota bucket."""
    limiter = _Limiter(default_limit="1/minute")

    limiter.check("/api/test", "client-1", None)
    limiter.check("/api/test", "client-2", None)

    with pytest.raises(RateLimitExceeded):
        limiter.check("/api/test", "client-1", None)
