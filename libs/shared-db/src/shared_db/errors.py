"""
Error classification and operational observability stubs for Databricks backends.
"""

import json
import logging
from typing import Optional

from fastapi import HTTPException

logger = logging.getLogger(__name__)


def classify_sql_runtime_error(
    exc: Exception,
    *,
    missing_table_detail: Optional[str] = None,
) -> Optional[HTTPException]:
    """Map Databricks SQL runtime failures to client-facing HTTP errors."""
    msg = str(exc).lower()
    if "permission denied" in msg or "no access" in msg or "403" in msg:
        return HTTPException(
            status_code=403,
            detail="Forbidden: insufficient Unity Catalog privileges for this operation.",
        )
    if "401" in msg or "unauthorized" in msg:
        return HTTPException(status_code=401, detail="Token rejected by Databricks.")
    if missing_table_detail and (
        "table or view not found" in msg
        or "does not exist" in msg
        or "doesn't exist" in msg
    ):
        return HTTPException(status_code=503, detail=missing_table_detail)
    return None


def increment_observability_counter(
    name: str,
    *,
    tags: Optional[dict[str, str]] = None,
) -> None:
    """Emit a structured counter event (logging stub — wire a metrics sink here)."""
    logger.info(
        "metric.increment name=%s value=1 tags=%s",
        name,
        json.dumps(tags or {}, sort_keys=True, separators=(",", ":")),
    )


def send_operational_alert(
    *,
    subject: str,
    body: str,
    error_id: Optional[str] = None,
    request_path: Optional[str] = None,
) -> None:
    """Emit a structured operational alert log event (logging stub)."""
    logger.warning(
        "operational_alert subject=%s error_id=%s request_path=%s body=%s",
        subject,
        error_id or "unknown",
        request_path or "unknown",
        body,
    )
