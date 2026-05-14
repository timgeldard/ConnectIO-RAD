#!/usr/bin/env python3
"""Platform build script.

Steps:
  1. Build wheels for all platform-required Python packages (shared libs +
     app backends). Output to apps/platform/wheels/.
  2. Build CQ frontend with VITE_BASE_PATH=/cq/ and copy dist to static/cq/.
  3. Build Trace frontend with VITE_BASE_PATH=/trace/ and copy dist to static/trace/.
  4. Build EnvMon frontend with VITE_BASE_PATH=/envmon/ and copy dist to static/envmon/.
  5. Build SPC frontend with VITE_BASE_PATH=/spc/ and copy dist to static/spc/.
  6. Build POH frontend with VITE_BASE_PATH=/poh/ and copy dist to static/poh/.
  7. Build W360 frontend with VITE_BASE_PATH=/warehouse360/ and copy dist to
     static/warehouse360/.
  8. Build Platform frontend (base=/) and copy dist to static/home/.
  9. Copy standalone app sources from standalone/<slug>/ to static/<slug>/.

Run via `make deploy` or `python3 scripts/build.py` from the app root
(apps/platform/).

Wheels replace the older file-copy approach. They are installed at runtime via
`pip install --find-links ./wheels -r requirements.txt`. Source duplication
under apps/platform/<package>_backend/ is no longer needed and any stale copies
are removed at the start of the build.
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
import tomllib
from pathlib import Path

APP_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = APP_DIR.parents[1]
CQ_DIR = REPO_ROOT / "apps" / "connectedquality"
TRACE_DIR = REPO_ROOT / "apps" / "trace2"
ENVMON_DIR = REPO_ROOT / "apps" / "envmon"
SPC_DIR = REPO_ROOT / "apps" / "spc"
POH_DIR = REPO_ROOT / "apps" / "processorderhistory"
W360_DIR = REPO_ROOT / "apps" / "warehouse360"
PLATFORM_FRONTEND_DIR = APP_DIR / "frontend"
STANDALONE_DIR = APP_DIR / "standalone"
WHEELS_DIR = APP_DIR / "wheels"


def _collect_shared_deps(pyproject_path: Path) -> set[str]:
    """Return the set of ``shared-*`` dependency names declared in a pyproject.toml.

    Args:
        pyproject_path: Absolute path to a ``pyproject.toml`` file.

    Returns:
        Set of dependency names (without version specifiers) that start with
        ``shared-``.
    """
    with pyproject_path.open("rb") as fh:
        data = tomllib.load(fh)
    deps: list[str] = data.get("project", {}).get("dependencies", [])
    return {re.split(r"[\s><=!~\[]", d)[0] for d in deps if d.startswith("shared-")}


def _derive_wheel_packages(deploy_toml_path: Path, repo_root: Path) -> list[Path]:
    """Derive the wheel package list from ``deploy.toml`` and backend pyproject.tomls.

    Reads ``[platform].bundled_apps`` from *deploy_toml_path*, then scans each
    app backend's ``pyproject.toml`` for ``shared-*`` deps.  A single transitive
    pass over the discovered shared libs catches any shared-lib → shared-lib
    edges.

    Args:
        deploy_toml_path: Path to the platform ``deploy.toml``.
        repo_root: Repository root used to resolve relative paths.

    Returns:
        Ordered list of package directories: shared libs (alphabetical) followed
        by app backends in ``bundled_apps`` declaration order.
    """
    with deploy_toml_path.open("rb") as fh:
        deploy = tomllib.load(fh)
    bundled_apps: list[str] = deploy.get("platform", {}).get("bundled_apps", [])

    app_backend_dirs: list[Path] = []
    shared_names: set[str] = set()

    for app_path in bundled_apps:
        backend_dir = repo_root / app_path / "backend"
        app_backend_dirs.append(backend_dir)
        pyproject = backend_dir / "pyproject.toml"
        if pyproject.exists():
            shared_names.update(_collect_shared_deps(pyproject))

    # One transitive pass: collect shared-* deps of the shared libs found above.
    for name in list(shared_names):
        lib_pyproject = repo_root / "libs" / name / "pyproject.toml"
        if lib_pyproject.exists():
            shared_names.update(_collect_shared_deps(lib_pyproject))

    shared_lib_dirs = sorted(repo_root / "libs" / name for name in shared_names)
    return shared_lib_dirs + app_backend_dirs


WHEEL_PACKAGES: list[Path] = _derive_wheel_packages(APP_DIR / "deploy.toml", REPO_ROOT)

LEGACY_COPY_DIRECTORIES = (
    "shared_api",
    "shared_auth",
    "shared_db",
    "shared_ddd",
    "shared_manufacturing",
    "shared_trace",
    "shared_geo",
    "connectedquality_backend",
    "processorderhistory_backend",
    "warehouse360_backend",
    "poh_backend",
    "cq_backend",
    "w360_backend",
)

STANDALONE_SLUGS = [
    "enzymes",
    "pi-sheet",
    "maintenance",
    "tpm",
    "pex-e-35",
    "blue-sky-trace",
    "traceability-portfolio",
    "operations-suite",
    "quality-suite",
    "factory-mood-board",
]


def remove_legacy_source_copies() -> None:
    """Remove any stale per-package source copies left behind by the previous
    file-copy build approach.

    These directories are gitignored so deleting them is safe and only affects
    the local working tree.
    """
    for name in LEGACY_COPY_DIRECTORIES:
        target = APP_DIR / name
        if target.exists():
            shutil.rmtree(target)
            print(f"-> removed legacy copy {name}")


def build_wheels() -> None:
    """Build a wheel for every platform-required package via uv.

    Raises:
        RuntimeError: if any wheel fails to build.
    """
    if WHEELS_DIR.exists():
        shutil.rmtree(WHEELS_DIR)
    WHEELS_DIR.mkdir()

    failures: list[str] = []
    for package_dir in WHEEL_PACKAGES:
        rel = package_dir.relative_to(REPO_ROOT)
        print(f"-> building wheel for {rel}")
        result = subprocess.run(
            ["uv", "build", "--wheel", "--out-dir", str(WHEELS_DIR), str(package_dir)],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            failures.append(f"{rel}: {result.stderr.strip()}")
            print(f"   FAILED — {result.stderr.strip()}", file=sys.stderr)
        else:
            print("   ok")

    if failures:
        joined = "\n  ".join(failures)
        raise RuntimeError(f"Failed to build {len(failures)} wheel(s):\n  {joined}")


def build_frontend(app_frontend_dir: Path, base_path: str, nx_project: str | None = None) -> None:
    """Run a Vite frontend build, optionally via Nx for caching.

    When ``nx_project`` is provided the build is delegated to
    ``npx nx run <nx_project>:build`` so Nx can skip the build on a cache hit.
    The project's ``build`` target must bake ``VITE_BASE_PATH`` into its command
    so the cache key is independent of the caller environment.

    When ``nx_project`` is ``None`` the build falls back to ``npm run build``
    with ``VITE_BASE_PATH`` set in the environment (legacy path).

    Args:
        app_frontend_dir: Frontend project directory (contains package.json).
        base_path: Vite base path under which the SPA is served.
        nx_project: Nx project name to delegate to, or ``None`` for the legacy path.
    """
    if nx_project:
        subprocess.run(
            f"npx nx run {nx_project}:build --output-style=stream",
            cwd=REPO_ROOT,
            shell=True,
            check=True,
        )
    else:
        env = {**os.environ, "VITE_BASE_PATH": base_path}
        subprocess.run(
            "npm run build", cwd=app_frontend_dir, shell=True, check=True, env=env
        )


def copy_static(src: Path, dst: Path) -> None:
    """Replace dst directory with the contents of src.

    Args:
        src: Source directory.
        dst: Destination directory; removed first if it exists.
    """
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(src, dst)


def build_platform_frontend() -> None:
    """Build the platform portal frontend and copy dist to static/home/.

    Also copies module-manifest.json alongside the built assets so the backend
    manifest endpoint can serve it as a static file at runtime.  Vite bundles
    the JSON as an ES module import; it does not emit a separate file to dist/,
    so we copy it explicitly after the build.
    """
    build_frontend(PLATFORM_FRONTEND_DIR, "/")
    copy_static(PLATFORM_FRONTEND_DIR / "dist", APP_DIR / "static" / "home")
    shutil.copy(
        PLATFORM_FRONTEND_DIR / "src" / "shell" / "module-manifest.json",
        APP_DIR / "static" / "home" / "module-manifest.json",
    )


def sync_requirements() -> None:
    """Rewrite the ./wheels/ lines in requirements.txt to match built wheels.

    Called immediately after build_wheels() so that requirements.txt always
    references the wheel filenames that will be present in the bundle. This
    prevents the "file does not exist" pip error that occurs when a package
    version is bumped in pyproject.toml but the pin in requirements.txt is not
    updated to match.
    """
    req_path = APP_DIR / "requirements.txt"
    built: dict[str, str] = {
        whl.name.split("-")[0]: whl.name
        for whl in WHEELS_DIR.glob("*.whl")
    }
    lines = req_path.read_text(encoding="utf-8").splitlines(keepends=True)
    updated: list[str] = []
    changes: list[str] = []
    for line in lines:
        stripped = line.rstrip("\n").rstrip("\r")
        if stripped.startswith("./wheels/") and stripped.endswith(".whl"):
            pkg_name = stripped.split("/")[-1].split("-")[0]
            if pkg_name in built and f"./wheels/{built[pkg_name]}" != stripped:
                changes.append(f"  {stripped} -> ./wheels/{built[pkg_name]}")
                updated.append(f"./wheels/{built[pkg_name]}\n")
            else:
                updated.append(line)
        else:
            updated.append(line)
    req_path.write_text("".join(updated), encoding="utf-8")
    if changes:
        print(f"-> synced {len(changes)} wheel pin(s) in requirements.txt:")
        for c in changes:
            print(c)
    else:
        print("-> requirements.txt wheel pins up to date")


def copy_standalone_apps() -> None:
    """Copy standalone HTML apps from standalone/<slug>/ to static/<slug>/."""
    for slug in STANDALONE_SLUGS:
        src = STANDALONE_DIR / slug
        if src.exists():
            copy_static(src, APP_DIR / "static" / slug)
            print(f"-> copied standalone/{slug}")
        else:
            print(f"-> WARNING: standalone/{slug} not found, skipping")


if __name__ == "__main__":
    remove_legacy_source_copies()
    build_wheels()
    sync_requirements()

    print("-> building CQ frontend (base=/cq/)")
    build_frontend(CQ_DIR / "frontend", "/cq/")
    copy_static(CQ_DIR / "frontend" / "dist", APP_DIR / "static" / "cq")
    print("-> CQ static ready")

    print("-> building Trace frontend (base=/trace/)")
    build_frontend(TRACE_DIR / "frontend", "/trace/")
    copy_static(TRACE_DIR / "frontend" / "dist", APP_DIR / "static" / "trace")
    print("-> Trace static ready")

    print("-> building EnvMon frontend (base=/envmon/)")
    build_frontend(ENVMON_DIR / "frontend", "/envmon/")
    copy_static(ENVMON_DIR / "frontend" / "dist", APP_DIR / "static" / "envmon")
    print("-> EnvMon static ready")

    print("-> building SPC frontend (base=/spc/)")
    build_frontend(SPC_DIR / "frontend", "/spc/")
    copy_static(SPC_DIR / "frontend" / "dist", APP_DIR / "static" / "spc")
    print("-> SPC static ready")

    print("-> building POH frontend (base=/poh/)")
    build_frontend(POH_DIR / "frontend", "/poh/")
    copy_static(POH_DIR / "frontend" / "dist", APP_DIR / "static" / "poh")
    print("-> POH static ready")

    print("-> building W360 frontend (base=/warehouse360/)")
    build_frontend(W360_DIR / "frontend", "/warehouse360/")
    copy_static(W360_DIR / "frontend" / "dist", APP_DIR / "static" / "warehouse360")
    print("-> W360 static ready")

    print("-> building Platform frontend (base=/)")
    build_platform_frontend()
    print("-> Platform static ready")

    copy_standalone_apps()

    sys.exit(0)
