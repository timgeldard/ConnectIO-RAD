"""Platform utility helpers — module discovery for the composite shell.

The platform shell imports routers from several upstream packages (CQ, POH,
W360, plus shared libs). Rather than letting an `ImportError` at module load
time abort the whole process, these helpers wrap the imports and classify
failures as either *required* (fail loud at startup) or *optional* (log a
warning and continue, with the artifact recorded for `/health/routers`).

Required failures raise immediately so a broken deploy never silently 404s
the affected routes. Optional failures are surfaced via
`get_missing_optional_artifacts()` and the readiness probe.
"""
from __future__ import annotations

import logging
from importlib import import_module
from typing import Any

logger = logging.getLogger(__name__)

_missing_optional_artifacts: dict[str, str] = {}


class RequiredArtifactMissing(RuntimeError):
    """Raised when a *required* platform artifact fails to import.

    Configured at module-import time by `_optional_attr(..., required=True)`.
    The platform should fail to start rather than register a partial route
    surface.
    """


def _optional_attr(
    module_name: str,
    attr_name: str,
    artifact: str | None = None,
    *,
    required: bool = False,
) -> Any | None:
    """Import an attribute from a module, tracking failures.

    Args:
        module_name: Fully-qualified Python module path.
        attr_name: Attribute to fetch from the loaded module.
        artifact: Key under which to record an optional failure. Defaults to
            ``module_name`` so each module gets its own slot — sharing the key
            across routers conflates unrelated failures.
        required: When True, an import failure raises
            :class:`RequiredArtifactMissing`. When False, the failure is
            logged and recorded; the caller receives ``None`` so the rest of
            the platform can still come up.

    Returns:
        The resolved attribute, or ``None`` when the import failed and
        ``required`` was False.

    Raises:
        RequiredArtifactMissing: If ``required`` is True and the import or
            attribute lookup fails for any reason.
    """
    key = artifact or module_name
    try:
        return getattr(import_module(module_name), attr_name)
    except Exception as exc:
        error_str = f"{type(exc).__name__}: {exc}"
        if required:
            logger.error(
                "Required platform artifact missing — %s.%s: %s",
                module_name,
                attr_name,
                error_str,
            )
            raise RequiredArtifactMissing(
                f"Required platform artifact missing: {module_name}.{attr_name}: {error_str}"
            ) from exc
        _missing_optional_artifacts[key] = error_str
        logger.warning(
            "Optional artifact unavailable — %s.%s: %s",
            module_name,
            attr_name,
            error_str,
        )
        return None


def get_missing_optional_artifacts() -> dict[str, str]:
    """Return the map of optional artifacts that failed to import."""
    return dict(_missing_optional_artifacts)


def get_missing_artifacts() -> dict[str, str]:
    """Backwards-compatible alias retained for older call sites.

    Equivalent to :func:`get_missing_optional_artifacts`. Prefer the new name
    for clarity in new code.
    """
    return get_missing_optional_artifacts()
