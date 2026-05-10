"""Observability helpers for ConnectIO-RAD FastAPI applications."""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any


class JsonLogFormatter(logging.Formatter):
    """Format log records as compact JSON for Databricks App logs."""

    def format(self, record: logging.LogRecord) -> str:
        """Return a structured JSON log line."""
        payload: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for attr in ("request_id", "user_email", "app_name", "path", "method", "status_code"):
            value = getattr(record, attr, None)
            if value is not None:
                if attr == "user_email" and isinstance(value, str) and "@" in value:
                    # Redact PII: user@domain.com -> u***@domain.com
                    parts = value.split("@")
                    payload[attr] = f"{parts[0][0]}***@{parts[1]}"
                else:
                    payload[attr] = value
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str, separators=(",", ":"))


def configure_json_logging(*, app_name: str, level: str | None = None) -> None:
    """
    Configure root logging for JSON output.

    Args:
        app_name: Stable app identifier added to emitted log records.
        level: Optional log level override. Defaults to ``APP_LOG_LEVEL`` or
            ``INFO``.
    """
    root = logging.getLogger()
    root.setLevel((level or os.environ.get("APP_LOG_LEVEL") or "INFO").upper())
    handler = logging.StreamHandler()
    handler.setFormatter(JsonLogFormatter())
    root.handlers[:] = [handler]
    logging.setLogRecordFactory(_record_factory(app_name))


def _record_factory(app_name: str):
    previous_factory = logging.getLogRecordFactory()

    def factory(*args: Any, **kwargs: Any) -> logging.LogRecord:
        record = previous_factory(*args, **kwargs)
        if not hasattr(record, "app_name"):
            record.app_name = app_name
        return record

    return factory


def configure_opentelemetry(app: Any, *, service_name: str, enabled: bool = True) -> bool:
    """
    Instrument a FastAPI app with OpenTelemetry when optional packages exist.

    Args:
        app: FastAPI application instance.
        service_name: Service name attached to traces.
        enabled: Disable switch for local tests.

    Returns:
        True when instrumentation was applied, otherwise False.
    """
    if not enabled:
        return False
    try:
        from opentelemetry import trace
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.sdk.trace import TracerProvider
    except ImportError:
        logging.getLogger(__name__).debug("opentelemetry.not_installed service=%s", service_name)
        return False

    provider = TracerProvider(resource=Resource.create({"service.name": service_name}))
    trace.set_tracer_provider(provider)
    FastAPIInstrumentor.instrument_app(app)
    return True
