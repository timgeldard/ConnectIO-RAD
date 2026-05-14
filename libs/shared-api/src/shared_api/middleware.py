"""
Custom middleware for ConnectIO-RAD FastAPI applications.

Includes middleware for latency monitoring and request context management.
"""
from __future__ import annotations

import inspect
import logging
import os
import re
import time
import uuid
from collections.abc import Callable
from typing import Any

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.types import ASGIApp


logger = logging.getLogger(__name__)
_REQUEST_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$")
_FORWARDED_USER_RE = re.compile(r"^[^\s\x00-\x1f\x7f]{1,320}$")


def _normalize_request_id(raw_request_id: str | None) -> str:
    """Return a safe request identifier for logs and response headers.

    Args:
        raw_request_id: The caller-supplied ``x-request-id`` header value.

    Returns:
        A validated request identifier, or a generated UUID if the header is
        empty or contains unsafe characters.
    """
    candidate = (raw_request_id or "").strip()
    if _REQUEST_ID_RE.fullmatch(candidate):
        return candidate
    return str(uuid.uuid4())


def _normalize_forwarded_user(raw_user: str | None) -> str:
    """Return a safe forwarded username for request context storage.

    Args:
        raw_user: The caller-supplied ``x-forwarded-preferred-username`` value.

    Returns:
        A sanitized username string, or ``anonymous`` when the header is empty
        or contains whitespace/control characters that would make audit logs
        ambiguous.
    """
    candidate = (raw_user or "").strip()
    if not candidate:
        return "anonymous"
    if _FORWARDED_USER_RE.fullmatch(candidate):
        return candidate
    logger.warning("request_context.invalid_forwarded_user")
    return "anonymous"


class LatencyMiddleware(BaseHTTPMiddleware):
    """
    Middleware that monitors request latency and triggers alerts if budgets are exceeded.
    """
    def __init__(
        self,
        app: ASGIApp,
        *,
        latency_budgets_ms: dict[str, int] | None = None,
        default_latency_budget_ms: int = 10_000,
        alert_callback: Callable[[str, int, int, int], Any] | None = None,
    ) -> None:
        """
        Initialize the latency middleware.

        Args:
            app: The ASGI application.
            latency_budgets_ms: Specific latency budgets per request path.
            default_latency_budget_ms: Default budget for paths not specified in latency_budgets_ms.
            alert_callback: Optional callback to trigger when a budget is exceeded.
        """
        super().__init__(app)
        self.latency_budgets_ms = latency_budgets_ms or {}
        self.default_latency_budget_ms = default_latency_budget_ms
        self.alert_callback = alert_callback

    async def dispatch(self, request: Request, call_next):
        """
        Record start time, call next handler, and log/alert on completion.
        """
        started_at = time.monotonic()
        response = None
        try:
            response = await call_next(request)
            return response
        finally:
            duration_ms = int((time.monotonic() - started_at) * 1000)
            status_code = getattr(response, "status_code", 500)
            request_path = request.url.path
            
            budget_ms = self.latency_budgets_ms.get(request_path, self.default_latency_budget_ms)
            
            # DEBUG so a healthy app doesn't drown its log channel with one
            # line per request. Latency-budget breaches are logged at INFO via
            # the alert callback below; that's where the actually-actionable
            # signal lives.
            logger.debug(
                "request.completed path=%s status=%d duration_ms=%d",
                request_path,
                status_code,
                duration_ms,
            )
            
            if duration_ms > budget_ms and self.alert_callback:
                try:
                    result = self.alert_callback(request_path, duration_ms, budget_ms, status_code)
                    if inspect.isawaitable(result):
                        # Since dispatch is not in an event loop that we control easily for 
                        # async callbacks when the middleware itself is BaseHTTPMiddleware,
                        # we need to be careful. BaseHTTPMiddleware.dispatch IS async.
                        await result
                except Exception:
                    logger.exception("latency_alert.failed path=%s", request_path)


class RequestContextMiddleware(BaseHTTPMiddleware):
    """
    Middleware that populates request.state with tracing and identity information.
    """
    def __init__(self, app: ASGIApp, trust_forwarded_user: bool = False) -> None:
        """
        Initialize the request context middleware.

        Args:
            app: The ASGI application.
            trust_forwarded_user: Whether to trust the x-forwarded-preferred-username header.
        """
        super().__init__(app)
        self.trust_forwarded_user = trust_forwarded_user

    async def dispatch(self, request: Request, call_next):
        """
        Extract request_id and user identity from headers and populate request.state.
        """
        request_id = _normalize_request_id(request.headers.get("x-request-id"))
        
        # Identity extraction: We only trust the forwarded header if explicitly configured.
        # Otherwise, user_email remains anonymous unless set later by auth dependencies.
        user_email = "anonymous"
        if self.trust_forwarded_user:
            user_email = _normalize_forwarded_user(
                request.headers.get("x-forwarded-preferred-username")
            )
        
        request.state.request_id = request_id
        request.state.user_email = user_email
        
        response = await call_next(request)
        response.headers["x-request-id"] = request_id
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Attach conservative security headers to every response."""

    def __init__(self, app: ASGIApp) -> None:
        """Initialize middleware with environment-controlled strict headers."""
        super().__init__(app)
        self.strict_headers_enabled = os.environ.get(
            "APP_DISABLE_STRICT_SECURITY_HEADERS", ""
        ).strip().lower() not in {"1", "true", "yes", "on"}

    async def dispatch(self, request: Request, call_next):
        """Attach headers after downstream processing completes."""
        response = await call_next(request)
        response.headers.setdefault("x-content-type-options", "nosniff")
        response.headers.setdefault("x-frame-options", "DENY")
        response.headers.setdefault("referrer-policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("permissions-policy", "camera=(), microphone=(), geolocation=()")
        response.headers.setdefault("cache-control", "no-store")
        if self.strict_headers_enabled:
            response.headers.setdefault(
                "content-security-policy",
                "default-src 'self'; frame-ancestors 'none'",
            )
            response.headers.setdefault(
                "strict-transport-security",
                "max-age=31536000; includeSubDomains",
            )
        return response
