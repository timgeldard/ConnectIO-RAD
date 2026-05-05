"""Platform utility helpers."""
from importlib import import_module
from typing import Any

_missing_build_artifacts: dict[str, str] = {}


def _optional_attr(module_name: str, attr_name: str, artifact: str) -> Any | None:
    """Import an attribute from a module if it exists, tracking missing artifacts."""
    try:
        return getattr(import_module(module_name), attr_name)
    except (ModuleNotFoundError, AttributeError) as exc:
        _missing_build_artifacts[artifact] = str(exc)
        return None


def get_missing_artifacts() -> dict[str, str]:
    """Return the map of missing build artifacts."""
    return _missing_build_artifacts
