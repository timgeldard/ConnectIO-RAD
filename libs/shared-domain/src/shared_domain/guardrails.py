"""Small helpers for DDD boundary tests and generated app validation."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class LayeredModulePath:
    """Parsed location of a module inside a DDD bounded context."""

    app_name: str
    context_name: str
    layer: str
    path: Path


def parse_layered_module_path(path: Path) -> LayeredModulePath | None:
    """
    Parse ``apps/<app>/backend/<pkg>/<context>/<layer>/<file>.py`` paths.

    Args:
        path: Absolute or relative Python module path.

    Returns:
        Parsed metadata when the path matches the ConnectIO-RAD app layout.
    """
    parts = path.parts
    if len(parts) < 7 or parts[0] != "apps" or parts[2] != "backend":
        return None
    layer = parts[5]
    if layer not in {"domain", "application", "dal", "infrastructure", "routers"}:
        return None
    return LayeredModulePath(app_name=parts[1], context_name=parts[4], layer=layer, path=path)


def is_infrastructure_import(module: str) -> bool:
    """Return True when an import points at transport, persistence, or framework code."""
    return (
        module.startswith("fastapi")
        or module.startswith("sqlalchemy")
        or ".dal" in module
        or ".infrastructure" in module
        or ".routers" in module
        or ".router" in module
    )
