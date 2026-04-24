"""Compatibility shim for the shared API security middleware."""

import os

os.environ.setdefault("APP_TRUST_X_FORWARDED_HOST", "true")

from shared_api.security import SameOriginMiddleware

__all__ = ["SameOriginMiddleware"]
