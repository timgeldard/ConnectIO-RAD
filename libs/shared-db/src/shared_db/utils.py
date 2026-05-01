import logging
import uuid
from typing import Optional, Awaitable, Protocol

from fastapi import HTTPException
from shared_db.errors import classify_sql_runtime_error

logger = logging.getLogger(__name__)


class FreshnessAttacher(Protocol):
    """
    Protocol for a function that attaches freshness metadata to a payload.
    
    Matches the backend signature of attach_data_freshness.
    """
    async def __call__(
        self,
        payload: dict,
        token: str,
        source_views: list[str],
        *,
        request_path: Optional[str] = None
    ) -> dict:
        """
        Attach freshness metadata to a payload.

        Args:
            payload: Response payload to enrich.
            token: Access token used for freshness lookup.
            source_views: Backing views used to compute freshness metadata.
            request_path: Optional request path for contextual logging/handling.

        Returns:
            The payload enriched with freshness metadata.

        Raises:
            HTTPException: If freshness lookup fails in a non-recoverable way.
        """
        ...


async def attach_validation_freshness(
    payload: dict,
    token: str,
    request_path: str,
    attach_freshness_func: FreshnessAttacher
) -> dict:
    """Best-effort freshness for material validation."""
    try:
        return await attach_freshness_func(
            payload,
            token,
            ["gold_batch_quality_result_v", "gold_material"],
            request_path=request_path,
        )
    except HTTPException as exc:
        detail = exc.detail if isinstance(exc.detail, dict) else {}
        if exc.status_code == 503 and detail.get("message") == "Data freshness lookup failed":
            return {
                **payload,
                "data_freshness": None,
                "data_freshness_warning": detail,
            }
        raise


async def attach_payload_freshness(
    payload: dict,
    token: str,
    request_path: str,
    source_views: list[str],
    attach_freshness_func: FreshnessAttacher
) -> dict:
    """Attach freshness metadata for a generic response payload."""
    try:
        return await attach_freshness_func(
            payload,
            token,
            source_views,
            request_path=request_path,
        )
    except HTTPException as exc:
        detail = exc.detail if isinstance(exc.detail, dict) else {}
        if exc.status_code == 503 and detail.get("message") == "Data freshness lookup failed":
            return {
                **payload,
                "data_freshness": None,
                "data_freshness_warning": detail,
            }
        raise


def handle_sql_error(exc: Exception) -> None:
    """Convert common SQL errors to appropriate HTTP status codes."""
    mapped_error = classify_sql_runtime_error(exc)
    if mapped_error is not None:
        raise mapped_error

    error_id = str(uuid.uuid4())
    logger.exception("sql_error error_id=%s", error_id, exc_info=exc)
    raise HTTPException(
        status_code=500,
        detail=f"Internal server error; reference id: {error_id}",
    )


def handle_analysis_error(exc: Exception) -> None:
    """Handle errors from analysis endpoints, surfacing user-facing validation messages.

    LinAlgError → 422 with a user-friendly explanation of the degenerate matrix case.
    ValueError  → 422 with the exception message passed through to the client.
    Anything else falls through to handle_sql_error for standard SQL / 500 handling.
    """
    # Check for LinAlgError without requiring a direct numpy dependency at the shared layer
    if "LinAlgError" in type(exc).__name__:
        raise HTTPException(
            status_code=422,
            detail=(
                "The selected characteristics produce a degenerate covariance matrix. "
                "Try removing highly correlated or zero-variance variables."
            ),
        )
    if isinstance(exc, ValueError):
        raise HTTPException(status_code=422, detail=str(exc))
    handle_sql_error(exc)


def handle_locked_limits_error(exc: Exception) -> None:
    """Handle errors from locked-limits endpoints, with a clear 503 for missing table."""
    msg = str(exc).lower()
    if "table or view not found" in msg or "doesn't exist" in msg or "does not exist" in msg:
        raise HTTPException(
            status_code=503,
            detail=(
                "Locked limits table not initialised in this workspace. "
                "Apply migration scripts/migrations/000_setup_locked_limits.sql "
                "through the deploy pipeline before using locked limits."
            ),
        )
    handle_sql_error(exc)
