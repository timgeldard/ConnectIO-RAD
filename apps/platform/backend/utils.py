"""Platform utility helpers."""
import logging
from importlib import import_module
from typing import Any

logger = logging.getLogger(__name__)
_missing_build_artifacts: dict[str, str] = {}


def _optional_attr(module_name: str, attr_name: str, artifact: str) -> Any | None:
    """Import an attribute from a module if it exists, tracking missing artifacts."""
    try:
        return getattr(import_module(module_name), attr_name)
    except Exception as exc:
        error_str = f"{type(exc).__name__}: {exc}"
        _missing_build_artifacts[artifact] = error_str
        logger.warning("Optional artifact unavailable — %s.%s: %s", module_name, attr_name, error_str)
        return None


def get_missing_artifacts() -> dict[str, str]:
    """Return the map of missing build artifacts."""
    return _missing_build_artifacts
