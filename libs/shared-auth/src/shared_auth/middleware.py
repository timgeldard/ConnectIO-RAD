from fastapi import Request


def get_token_from_request(request: Request) -> str | None:
    """
    Extract the bearer token from the incoming request.
    
    Checks 'x-forwarded-access-token' (set by Databricks Apps proxy) first,
    then falls back to the standard 'Authorization: Bearer' header.
    
    Args:
        request: The FastAPI/Starlette request object.
        
    Returns:
        The extracted token string if found, otherwise None.
    """
    token = request.headers.get("x-forwarded-access-token")
    if token:
        return token
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:]
    return None
