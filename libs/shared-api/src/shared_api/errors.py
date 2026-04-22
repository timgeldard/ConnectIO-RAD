from __future__ import annotations

import logging
import uuid

from fastapi import HTTPException
from fastapi.responses import JSONResponse
from starlette.requests import Request


async def safe_global_exception_response(
    request: Request,
    exc: Exception,
    *,
    logger_name: str,
) -> JSONResponse:
    if isinstance(exc, HTTPException):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

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
