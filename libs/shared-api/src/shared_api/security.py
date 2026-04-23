"""Origin-header enforcement for state-mutating requests.

The Databricks Apps deployment model serves each SPA and its FastAPI backend as
one same-origin surface. Token passthrough via `x-forwarded-access-token`
already blocks common browser CSRF paths because browsers cannot set that
header cross-origin, but Origin/Referer enforcement catches proxy
misconfiguration and future deployment drift.
"""

from __future__ import annotations

import logging
import os
from typing import Iterable
from urllib.parse import urlparse

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.types import ASGIApp

_SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
_log = logging.getLogger(__name__)


def _origin_host(origin_header: str) -> str | None:
    if not origin_header:
        return None
    try:
        parsed = urlparse(origin_header)
    except ValueError:
        return None
    if not parsed.netloc:
        return None
    return parsed.netloc.lower()


def _parse_env_allowed_origins() -> set[str]:
    raw = os.environ.get("APP_ALLOWED_ORIGINS", os.environ.get("SPC_ALLOWED_ORIGINS", "")).strip()
    if not raw:
        return set()
    hosts = set()
    for origin in raw.split(","):
        origin = origin.strip()
        if not origin:
            continue
        host = _origin_host(origin) or origin.lower().rstrip("/")
        if host:
            hosts.add(host)
    return hosts


def _trust_forwarded_host() -> bool:
    return os.environ.get("APP_TRUST_X_FORWARDED_HOST", "").strip().lower() in {"1", "true", "yes", "on"}


class SameOriginMiddleware(BaseHTTPMiddleware):
    """Reject mutating browser requests whose Origin/Referer does not match Host."""

    def __init__(self, app: ASGIApp, extra_allowed: Iterable[str] | None = None) -> None:
        super().__init__(app)
        self._static_allowed: set[str] = set()
        for origin in extra_allowed or ():
            host = _origin_host(origin) or origin.strip().lower().rstrip("/")
            if host:
                self._static_allowed.add(host)

    async def dispatch(self, request: Request, call_next):
        if request.method.upper() in _SAFE_METHODS:
            return await call_next(request)

        forwarded_chain = request.headers.get("x-forwarded-host", "")
        forwarded_host = forwarded_chain.split(",", 1)[0].lower().strip()
        direct_host = request.headers.get("host", "").lower().strip()
        origin_header = request.headers.get("origin") or ""
        referer_header = request.headers.get("referer") or ""

        browser_header = origin_header or referer_header
        if not browser_header:
            return await call_next(request)
        origin_host = _origin_host(browser_header)
        if origin_host is None:
            _log.warning(
                "cross_origin_mutation_blocked_invalid_origin method=%s path=%s host=%s origin=%s",
                request.method,
                request.url.path,
                direct_host,
                browser_header,
            )
            return JSONResponse(
                status_code=403,
                content={
                    "detail": "Cross-origin mutation blocked",
                    "origin": browser_header,
                },
            )

        allowed = self._static_allowed | _parse_env_allowed_origins()
        candidate_hosts = [direct_host]
        if _trust_forwarded_host():
            candidate_hosts.append(forwarded_host)
        candidates = {h for h in candidate_hosts if h} | allowed
        if origin_host in candidates:
            return await call_next(request)

        _log.warning(
            "cross_origin_mutation_blocked method=%s path=%s host=%s forwarded_host=%s origin=%s",
            request.method,
            request.url.path,
            direct_host,
            forwarded_host,
            origin_host,
        )
        return JSONResponse(
            status_code=403,
            content={
                "detail": "Cross-origin mutation blocked",
                "origin": origin_host,
            },
        )
