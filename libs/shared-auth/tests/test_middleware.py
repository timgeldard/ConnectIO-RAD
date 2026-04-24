from starlette.requests import Request

from shared_auth import get_token_from_request


def _request(headers: dict[str, str]) -> Request:
    return Request({"type": "http", "headers": [(k.lower().encode(), v.encode()) for k, v in headers.items()]})


def test_get_token_prefers_forwarded_access_token() -> None:
    request = _request(
        {
            "x-forwarded-access-token": "proxy-token",
            "authorization": "Bearer auth-token",
        }
    )

    assert get_token_from_request(request) == "proxy-token"


def test_get_token_falls_back_to_bearer_authorization() -> None:
    request = _request({"authorization": "Bearer auth-token"})

    assert get_token_from_request(request) == "auth-token"


def test_get_token_returns_none_when_absent() -> None:
    assert get_token_from_request(_request({})) is None
