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
    raw = os.environ.get("SPC_ALLOWED_ORIGINS", "").strip()
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

        origin_host = _origin_host(origin_header) or _origin_host(referer_header)
        if origin_host is None:
            return await call_next(request)

        allowed = self._static_allowed | _parse_env_allowed_origins()
        candidates = {h for h in (forwarded_host, direct_host) if h} | allowed
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
