"""
Global exception handlers and domain error definitions for shared-api.
"""
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
    """Raised when the application cannot connect to the database."""
    def __init__(self, message: str = "Could not connect to the database"):
        super().__init__(message, status_code=status.HTTP_503_SERVICE_UNAVAILABLE)


class UnauthorizedPlantAccess(DomainError):
    """Raised when a user attempts to access a plant they are not authorized for."""
    def __init__(self, plant_id: str):
        super().__init__(f"Unauthorized access to plant: {plant_id}", status_code=status.HTTP_403_FORBIDDEN)


async def safe_global_exception_response(
    request: Request,
    exc: Exception,
    *,
    logger_name: str,
) -> JSONResponse:
    """
    Standardizes exception responses across all ConnectIO-RAD services.

    Maps DomainError and HTTPException to consistent JSON structures, and
    provides a safe 500 fallback for unhandled exceptions with an error_id.

    Args:
        request: The Starlette/FastAPI request that triggered the error.
        exc: The exception instance caught by the handler.
        logger_name: The name of the logger to use for recording unhandled errors.

    Returns:
        A JSONResponse with the appropriate status code and detail structure.
    """
    if isinstance(exc, DomainError):
        content = {"detail": exc.message, "error_type": exc.__class__.__name__}
        if exc.detail is not None:
            content["extra"] = exc.detail
        return JSONResponse(
            status_code=exc.status_code,
            content=content,
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
