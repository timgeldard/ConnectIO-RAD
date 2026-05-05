"""Compatibility shim for the shared API security middleware."""

from shared_api.security import SameOriginMiddleware

__all__ = ["SameOriginMiddleware"]
