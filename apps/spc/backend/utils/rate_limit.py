"""
Rate limiting utilities for SPC backend.

Re-exports from shared-api for local use.
"""
from shared_api.rate_limit import (  # noqa: F401
    RateLimitExceeded,
    RateLimitMiddleware,
    limiter,
    rate_limit_handler,
    _extract_client_identity,
    _Limiter,
)

# Alias for backward compatibility if needed, though RateLimitMiddleware is preferred.
SlowAPIMiddleware = RateLimitMiddleware
