"""Regression tests for apps/platform/scripts/build.py wheel-package derivation.

These tests guard against silent drift between deploy.toml, backend
pyproject.tomls, and the WHEEL_PACKAGES list that drives the platform build.
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
BUILD_SCRIPT = REPO_ROOT / "apps" / "platform" / "scripts" / "build.py"
DEPLOY_TOML = REPO_ROOT / "apps" / "platform" / "deploy.toml"


def _load_build_module():
    """Import build.py as a module without executing its __main__ block.

    Returns:
        The loaded ``platform_build`` module with all top-level symbols available.
    """
    spec = importlib.util.spec_from_file_location("platform_build", BUILD_SCRIPT)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope="module")
def build():
    """Loaded build module, shared across tests in this file."""
    return _load_build_module()


# ---------------------------------------------------------------------------
# _collect_shared_deps
# ---------------------------------------------------------------------------

def test_collect_shared_deps_returns_only_shared_prefixed(build, tmp_path):
    """Only dependencies whose names start with 'shared-' are returned."""
    pyproject = tmp_path / "pyproject.toml"
    pyproject.write_bytes(
        b'[project]\nname = "x"\ndependencies = ["shared-db", "fastapi", "shared-api>=1"]\n'
    )
    result = build._collect_shared_deps(pyproject)
    assert result == {"shared-db", "shared-api"}


def test_collect_shared_deps_ignores_extras(build, tmp_path):
    """Extras like ``shared-auth[jwt]`` are normalised to ``shared-auth``."""
    pyproject = tmp_path / "pyproject.toml"
    pyproject.write_bytes(b'[project]\nname = "x"\ndependencies = ["shared-auth[jwt]"]\n')
    result = build._collect_shared_deps(pyproject)
    assert result == {"shared-auth"}


def test_collect_shared_deps_empty_on_no_shared(build, tmp_path):
    """Returns an empty set when no ``shared-*`` dependencies exist."""
    pyproject = tmp_path / "pyproject.toml"
    pyproject.write_bytes(b'[project]\nname = "x"\ndependencies = ["fastapi", "uvicorn"]\n')
    assert build._collect_shared_deps(pyproject) == set()


# ---------------------------------------------------------------------------
# _derive_wheel_packages (against the real repo layout)
# ---------------------------------------------------------------------------

EXPECTED_SHARED_LIBS = {
    "shared-api",
    "shared-auth",
    "shared-db",
    "shared-ddd",
    "shared-geo",
    "shared-manufacturing",
    "shared-trace",
}

EXPECTED_APP_BACKENDS = {
    "connectedquality",
    "envmon",
    "processorderhistory",
    "spc",
    "trace2",
    "warehouse360",
}


def test_derive_wheel_packages_shared_libs(build):
    """All 7 known shared libs are included."""
    result = build._derive_wheel_packages(DEPLOY_TOML, REPO_ROOT)
    derived_names = {p.name for p in result}
    assert EXPECTED_SHARED_LIBS.issubset(derived_names), (
        f"Missing shared libs: {EXPECTED_SHARED_LIBS - derived_names}"
    )


def test_derive_wheel_packages_app_backends(build):
    """All 6 bundled app backends are included (identified by parent dir name)."""
    result = build._derive_wheel_packages(DEPLOY_TOML, REPO_ROOT)
    app_parents = {p.parent.name for p in result if p.name == "backend"}
    assert app_parents == EXPECTED_APP_BACKENDS, (
        f"Backend mismatch — got {app_parents}, expected {EXPECTED_APP_BACKENDS}"
    )


def test_derive_wheel_packages_total_count(build):
    """Total is exactly 13: 7 shared libs + 6 app backends."""
    result = build._derive_wheel_packages(DEPLOY_TOML, REPO_ROOT)
    assert len(result) == 13, (
        f"Expected 13 packages, got {len(result)}: {[p.name for p in result]}"
    )


def test_derive_wheel_packages_shared_libs_come_first(build):
    """Shared libs are sorted and precede all app backends in the list."""
    result = build._derive_wheel_packages(DEPLOY_TOML, REPO_ROOT)
    lib_indices = [i for i, p in enumerate(result) if p.parent.name == "libs"]
    backend_indices = [i for i, p in enumerate(result) if p.name == "backend"]
    assert lib_indices and backend_indices
    assert max(lib_indices) < min(backend_indices), (
        "All shared libs must appear before all app backends"
    )


def test_derive_wheel_packages_all_paths_exist(build):
    """Every derived path resolves to an existing directory on disk."""
    result = build._derive_wheel_packages(DEPLOY_TOML, REPO_ROOT)
    missing = [str(p) for p in result if not p.exists()]
    assert not missing, f"Non-existent package paths: {missing}"


def test_wheel_packages_constant_matches_derivation(build):
    """The module-level WHEEL_PACKAGES constant equals the fresh derivation.

    This is the drift guard: if deploy.toml or a pyproject.toml is updated
    without a corresponding code change, this test will catch it at CI time.
    """
    derived = build._derive_wheel_packages(DEPLOY_TOML, REPO_ROOT)
    assert build.WHEEL_PACKAGES == derived
