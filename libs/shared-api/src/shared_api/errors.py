from __future__ import annotations

import logging
import uuid
from typing import Any

from fastapi import HTTPException, status
from fastapi.responses import JSONResponse
from starlette.requests import Request


class DomainError(Exception):
    """Base class for all domain-specific errors."""
    def __init__(self, message: str, status_code: int = status.HTTP_400_BAD_REQUEST, detail: Any | None = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.detail = detail


class DatabaseConnectionError(DomainError):
    def __init__(self, message: str = "Could not connect to the database"):
        super().__init__(message, status_code=status.HTTP_503_SERVICE_UNAVAILABLE)


class UnauthorizedPlantAccess(DomainError):
    def __init__(self, plant_id: str):
        super().__init__(f"Unauthorized access to plant: {plant_id}", status_code=status.HTTP_403_FORBIDDEN)


async def safe_global_exception_response(
    request: Request,
    exc: Exception,
    *,
    logger_name: str,
) -> JSONResponse:
    if isinstance(exc, DomainError):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.message, "error_type": exc.__class__.__name__, "extra": exc.detail},
        )
    
    if isinstance(exc, HTTPException):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail}, headers=exc.headers)

    error_id = str(uuid.uuid4())
    logging.getLogger(logger_name).exception(
        "Unhandled exception error_id=%s method=%s path=%s",
        error_id,
        request.method,
        request.url.path,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "error_id": error_id},
    )
