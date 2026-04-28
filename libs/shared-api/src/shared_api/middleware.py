from __future__ import annotations

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
    def __init__(
        self,
        app: ASGIApp,
        *,
        latency_budgets_ms: dict[str, int] | None = None,
        default_latency_budget_ms: int = 10_000,
        alert_callback: Callable[[str, int, int, int], Any] | None = None,
    ) -> None:
        super().__init__(app)
        self.latency_budgets_ms = latency_budgets_ms or {}
        self.default_latency_budget_ms = default_latency_budget_ms
        self.alert_callback = alert_callback

    async def dispatch(self, request: Request, call_next):
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
                    self.alert_callback(request_path, duration_ms, budget_ms, status_code)
                except Exception:
                    logger.exception("latency_alert.failed path=%s", request_path)


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("x-request-id", str(uuid.uuid4()))
        
        # In a real implementation we might extract user email from a JWT in the header
        # For now, we stub it.
        user_email = request.headers.get("x-forwarded-preferred-username", "anonymous")
        
        request.state.request_id = request_id
        request.state.user_email = user_email
        
        response = await call_next(request)
        response.headers["x-request-id"] = request_id
        return response
