"""
Custom middleware for ConnectIO-RAD FastAPI applications.

Includes middleware for latency monitoring and request context management.
"""
from __future__ import annotations

import inspect
import logging
import time
import uuid
from collections.abc import Callable
from typing import Any

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.types import ASGIApp


logger = logging.getLogger(__name__)


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
            
            logger.info(
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
        request_id = request.headers.get("x-request-id", str(uuid.uuid4()))
        
        # Identity extraction: We only trust the forwarded header if explicitly configured.
        # Otherwise, user_email remains anonymous unless set later by auth dependencies.
        user_email = "anonymous"
        if self.trust_forwarded_user:
            user_email = request.headers.get("x-forwarded-preferred-username", "anonymous")
        
        request.state.request_id = request_id
        request.state.user_email = user_email
        
        response = await call_next(request)
        response.headers["x-request-id"] = request_id
        return response
