from fastapi import Request


def get_token_from_request(request: Request) -> str | None:
    """Extract bearer token from x-forwarded-access-token or Authorization header."""
    token = request.headers.get("x-forwarded-access-token")
    if token:
        return token
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:]
    return None
