"""Tests for ``backend.utils`` — required vs optional artifact classification.

Each test constructs its own :class:`ArtifactTracker` so failures recorded
in one test never leak into another. This replaces the earlier autouse
fixture that cleared a module-level global; testing the class directly is
both cleaner and exercises the production path.
"""

import pytest

from backend.utils import (
    ArtifactTracker,
    PLATFORM_BACKEND_PACKAGES,
    RequiredArtifactMissing,
    _optional_attr,
    discover_app_routers,
    discover_active_modules,
    get_missing_optional_artifacts,
)


def test_required_attempt_raises_on_missing_module():
    """A required artifact that fails to import aborts startup.

    Verifies the contract that callers using ``required=True`` propagate
    ``RequiredArtifactMissing`` (rather than getting ``None`` back) so the
    platform can refuse to start with a partial route surface.
    """
    tracker = ArtifactTracker()
    with pytest.raises(RequiredArtifactMissing) as exc_info:
        tracker.attempt(
            "definitely_not_a_real_module_xyz", "router", required=True
        )
    assert "definitely_not_a_real_module_xyz" in str(exc_info.value)


def test_optional_attempt_returns_none_on_missing_module():
    """An optional artifact that fails to import logs a warning and returns None.

    Also confirms the module name is recorded in the tracker so
    ``GET /api/health/routers`` can surface the optional gap to ops.
    """
    tracker = ArtifactTracker()
    result = tracker.attempt(
        "definitely_not_a_real_module_xyz", "router", required=False
    )
    assert result is None
    assert "definitely_not_a_real_module_xyz" in tracker.missing()


def test_required_attempt_returns_attribute_when_module_exists():
    """A required import succeeds and returns the named attribute.

    Uses ``logging.getLogger`` as a stable real attribute on a real module
    so the test never depends on the platform's own router inventory.
    """
    tracker = ArtifactTracker()
    getter = tracker.attempt("logging", "getLogger", required=True)
    assert callable(getter)


def test_optional_artifact_key_defaults_to_module_name():
    """Per-module artifact keys prevent unrelated routers from sharing a slot.

    The pre-2026-05-07 implementation keyed every W360 router under one
    ``"warehouse360_backend"`` bucket, so a single broken router clobbered
    the readiness signal for unrelated ones. After the C3 fix the key is
    the module path; this test pins that contract.
    """
    tracker = ArtifactTracker()
    tracker.attempt("nonexistent_module_a", "router", required=False)
    tracker.attempt("nonexistent_module_b", "router", required=False)
    failures = tracker.missing()
    assert "nonexistent_module_a" in failures
    assert "nonexistent_module_b" in failures


def test_tracker_isolation_between_instances():
    """Two trackers do not see each other's recorded failures.

    Pins the result-object refactor: the previous module-level dict
    leaked state across tests; an instance-per-tracker design does not.
    """
    tracker_a = ArtifactTracker()
    tracker_b = ArtifactTracker()

    tracker_a.attempt("module_x", "router", required=False)

    assert "module_x" in tracker_a.missing()
    assert "module_x" not in tracker_b.missing()


def test_default_tracker_shim_still_works():
    """The ``_optional_attr`` convenience shim delegates to the default tracker.

    Production call sites (``backend.main``) still use the shim;
    ``get_missing_optional_artifacts()`` continues to return that
    tracker's map. This test ensures the shim path remains functional
    after the result-object refactor.
    """
    _optional_attr("definitely_not_a_real_module_via_shim", "router", required=False)
    assert "definitely_not_a_real_module_via_shim" in get_missing_optional_artifacts()


def test_platform_backend_packages_include_required_runtime_modules():
    """Runtime router registration uses packaged modules, not deployed source files."""
    assert PLATFORM_BACKEND_PACKAGES == [
        "connectedquality_backend",
        "envmon_backend",
        "processorderhistory_backend",
        "spc_backend",
        "trace2_backend",
        "warehouse360_backend",
    ]


def test_platform_backend_packages_register_poh_post_routes():
    """The packaged POH backend exposes the POST routes that were 405ing."""
    routers = discover_app_routers(PLATFORM_BACKEND_PACKAGES)

    registered: dict[str, set[str]] = {}
    for router, prefix, _tags in routers:
        for route in router.routes:
            path = f"{prefix}{route.path}"
            registered.setdefault(path, set()).update(getattr(route, "methods", set()))

    assert "POST" in registered["/api/poh/orders"]
    assert "POST" in registered["/api/poh/pours/analytics"]


def test_discover_active_modules_uses_backend_pyproject_when_deploy_omits_backend_project(tmp_path):
    """Router discovery follows backend package metadata, not stale deploy fields."""
    app_dir = tmp_path / "apps" / "warehouse360"
    backend_dir = app_dir / "backend"
    backend_dir.mkdir(parents=True)
    (app_dir / "deploy.toml").write_text(
        """
[app]
name = "warehouse360"
""",
        encoding="utf-8",
    )
    (backend_dir / "pyproject.toml").write_text(
        """
[project]
name = "warehouse360-backend"
""",
        encoding="utf-8",
    )

    assert discover_active_modules(tmp_path / "apps") == ["warehouse360_backend"]


def test_discover_active_modules_skips_platform_app(tmp_path):
    """The platform should discover sub-app routers, not recursively import itself."""
    app_dir = tmp_path / "apps" / "platform"
    backend_dir = app_dir / "backend"
    backend_dir.mkdir(parents=True)
    (app_dir / "deploy.toml").write_text(
        """
[app]
name = "platform"
""",
        encoding="utf-8",
    )
    (backend_dir / "pyproject.toml").write_text(
        """
[project]
name = "platform-backend"
""",
        encoding="utf-8",
    )

    assert discover_active_modules(tmp_path / "apps") == []
