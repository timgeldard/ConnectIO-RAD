"""Platform utility helpers — module discovery for the composite shell.

The platform shell imports routers from several upstream packages (CQ, POH,
W360, plus shared libs). Rather than letting an `ImportError` at module load
time abort the whole process, these helpers wrap the imports and classify
failures as either *required* (fail loud at startup) or *optional* (log a
warning and continue, with the artifact recorded for inspection later).

Required failures raise immediately so a broken deploy never silently 404s
the affected routes. Optional failures are recorded in the active
:class:`ArtifactTracker` and surfaced by the ``GET /api/health/routers``
endpoint defined in :mod:`backend.main`. The readiness probe (``/api/ready``)
only reports on the live SQL warehouse roundtrip — it intentionally does
*not* mention optional artifacts so a deferred-feature wheel doesn't keep
the app reporting not-ready.

Test isolation
--------------
Production code uses an implicit module-level :data:`_default_tracker` and
the convenience ``_optional_attr(...)`` shim. Tests should construct their
own :class:`ArtifactTracker` (``tracker = ArtifactTracker(); tracker.attempt(...)``)
so a test never accumulates state into the singleton — this replaces the
brittle "clear the global before/after each test" pattern that earlier
versions of this module forced on its tests.
"""
from __future__ import annotations

import logging
import tomllib
from importlib import import_module
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parents[3]


class RequiredArtifactMissing(RuntimeError):
    """Raised when a *required* platform artifact fails to import.

    Configured at module-import time by ``ArtifactTracker.attempt(...,
    required=True)`` (or the convenience ``_optional_attr`` shim). The
    platform should fail to start rather than register a partial route
    surface.
    """


class ArtifactTracker:
    """Per-tracker registry of artifacts that failed to import.

    A tracker is the unit of test isolation: production uses one instance
    (``_default_tracker``), and each test that needs to verify import
    failure recording can construct its own to avoid cross-test
    contamination. Tracker instances are not thread-safe; the platform
    only mutates them at module-load time, before request handling
    begins.
    """

    def __init__(self) -> None:
        """Create an empty tracker with no recorded failures."""
        self._failures: dict[str, str] = {}

    def attempt(
        self,
        module_name: str,
        attr_name: str,
        artifact: str | None = None,
        *,
        required: bool = False,
    ) -> Any | None:
        """Import an attribute from a module, recording or raising on failure.

        Args:
            module_name: Fully-qualified Python module path.
            attr_name: Attribute to fetch from the loaded module.
            artifact: Key under which to record an optional failure.
                Defaults to ``module_name`` so each module gets its own
                slot — sharing the key across routers conflates unrelated
                failures.
            required: When True, an import failure raises
                :class:`RequiredArtifactMissing`. When False, the failure
                is logged and recorded on this tracker; the caller
                receives ``None`` so the rest of the platform can still
                come up.

        Returns:
            The resolved attribute, or ``None`` when the import failed
            and ``required`` was False.

        Raises:
            RequiredArtifactMissing: If ``required`` is True and the
                import or attribute lookup fails.
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
            self._failures[key] = error_str
            logger.warning(
                "Optional artifact unavailable — %s.%s: %s",
                module_name,
                attr_name,
                error_str,
            )
            return None

    def missing(self) -> dict[str, str]:
        """Return a copy of the recorded optional-artifact failures."""
        return dict(self._failures)


# Production tracker. ``backend.main`` and the convenience shim below mutate
# this at module-load time. Tests should construct their own
# ``ArtifactTracker`` instances rather than reaching in here.
_default_tracker = ArtifactTracker()


def _optional_attr(
    module_name: str,
    attr_name: str,
    artifact: str | None = None,
    *,
    required: bool = False,
) -> Any | None:
    """Convenience shim that delegates to :data:`_default_tracker`.

    See :meth:`ArtifactTracker.attempt` for parameter and return semantics.
    """
    return _default_tracker.attempt(module_name, attr_name, artifact, required=required)


def _required_attr(
    module_name: str,
    attr_name: str,
    artifact: str | None = None,
) -> Any:
    """Convenience shim for required attributes.

    Delegates to :data:`_default_tracker` with required=True.
    """
    return _default_tracker.attempt(module_name, attr_name, artifact, required=True)


def get_missing_optional_artifacts() -> dict[str, str]:
    """Return the map of optional artifacts that failed to import."""
    return _default_tracker.missing()


def get_missing_artifacts() -> dict[str, str]:
    """Backwards-compatible alias retained for older call sites.

    Equivalent to :func:`get_missing_optional_artifacts`. Prefer the new name
    for clarity in new code.
    """
    return get_missing_optional_artifacts()


def discover_active_modules(apps_dir: Path = ROOT / "apps") -> list[str]:
    """Scan the apps directory for RAD modules and return their backend package names.

    A directory is considered a RAD module if it contains a deploy.toml file
    specifying a backend_project.
    """
    packages = []
    if not apps_dir.exists():
        return packages

    for deploy_toml in apps_dir.rglob("deploy.toml"):
        try:
            with open(deploy_toml, "rb") as f:
                config = tomllib.load(f)
                backend_project = config.get("app", {}).get("backend_project")
                if backend_project:
                    # Convention: spc-backend -> spc_backend
                    packages.append(backend_project.replace("-", "_"))
        except Exception as exc:
            logger.warning("Failed to parse %s: %s", deploy_toml, exc)

    return sorted(list(set(packages)))


def discover_app_routers(packages: list[str]) -> list[tuple[Any, str, list[str] | None]]:
    """Dynamically discover PLATFORM_ROUTERS from a list of backend packages.

    Args:
        packages: List of fully-qualified package names (e.g. ['spc_backend', 'poh_backend']).

    Returns:
        A flattened list of (router, prefix, tags) tuples ready for inclusion.
    """
    all_routers = []
    for pkg in packages:
        # Try <pkg>.routers.PLATFORM_ROUTERS
        routers = _optional_attr(f"{pkg}.routers", "PLATFORM_ROUTERS", required=False)
        if routers:
            all_routers.extend(routers)
        else:
            # Fallback for apps that might put it in <pkg>.main or similar if needed
            logger.info("No PLATFORM_ROUTERS found in %s.routers", pkg)

    return all_routers


def discover_app_manifests(packages: list[str]) -> list[dict[str, Any]]:
    """Dynamically discover MANIFEST dictionaries from a list of backend packages.

    Args:
        packages: List of fully-qualified package names (e.g. ['spc_backend', 'poh_backend']).

    Returns:
        A list of manifest objects ready for inclusion in the platform manifest.
    """
    all_manifests = []
    for pkg in packages:
        manifest = _optional_attr(f"{pkg}.manifest", "MANIFEST", required=False)
        if manifest:
            all_manifests.append(manifest)
        else:
            logger.info("No MANIFEST found in %s.manifest", pkg)

    return all_manifests
