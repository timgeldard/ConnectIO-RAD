#!/usr/bin/env python3
"""Platform build script.

Steps:
  1. Copy shared Python libs (shared_db, shared_api, shared_auth) into app root.
  2. Copy backend packages using their real package names so local, test, and
     Databricks imports all resolve the same modules.
  5. Build CQ frontend with VITE_BASE_PATH=/cq/ and copy dist to static/cq/.
  6. Build POH frontend with VITE_BASE_PATH=/poh/ and copy dist to static/poh/.
  7. Build W360 frontend with VITE_BASE_PATH=/warehouse360/ and copy dist to static/warehouse360/.
  8. Build Platform frontend (base=/) and copy dist to static/home/.
  9. Copy standalone app sources from standalone/<slug>/ to static/<slug>/.

Run via `make deploy` or `python3 scripts/build.py` from the app root.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

APP_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = APP_DIR.parents[1]
CQ_DIR = REPO_ROOT / "apps" / "connectedquality"
POH_DIR = REPO_ROOT / "apps" / "processorderhistory"
W360_DIR = REPO_ROOT / "apps" / "warehouse360"
PLATFORM_FRONTEND_DIR = APP_DIR / "frontend"
STANDALONE_DIR = APP_DIR / "standalone"

SHARED_LIBS = ["shared-db", "shared-api", "shared-auth"]
BACKEND_PACKAGES = {
    "connectedquality_backend": CQ_DIR / "backend" / "connectedquality_backend",
    "processorderhistory_backend": POH_DIR / "backend" / "processorderhistory_backend",
    "warehouse360_backend": W360_DIR / "backend" / "warehouse360_backend",
}

STANDALONE_SLUGS = ["enzymes", "pi-sheet", "warehouse", "maintenance", "tpm", "imwm", "pex-e-35", "lineside-monitor"]


def copy_shared_libs() -> None:
    for lib in SHARED_LIBS:
        package_name = lib.replace("-", "_")
        src = REPO_ROOT / "libs" / lib / "src" / package_name
        dst = APP_DIR / package_name
        if dst.exists():
            shutil.rmtree(dst)
        shutil.copytree(src, dst)
        print(f"-> copied {package_name}")


def copy_backend_packages() -> None:
    """Stage app backend packages under their real import names."""
    for package_name, src in BACKEND_PACKAGES.items():
        dst = APP_DIR / package_name
        if dst.exists():
            shutil.rmtree(dst)
        shutil.copytree(
            src,
            dst,
            ignore=shutil.ignore_patterns("tests", "__pycache__", "*.pyc"),
        )
        print(f"-> copied {package_name}")


def remove_legacy_backend_aliases() -> None:
    """Remove old alias package artifacts if they exist from earlier builds."""
    for alias in ("poh_backend", "cq_backend", "w360_backend"):
        dst = APP_DIR / alias
        if dst.exists():
            shutil.rmtree(dst)
            print(f"-> removed legacy {alias}")


def build_frontend(app_frontend_dir: Path, base_path: str) -> None:
    env = {**os.environ, "VITE_BASE_PATH": base_path}
    subprocess.run("npm run build", cwd=app_frontend_dir, shell=True, check=True, env=env)


def copy_static(src: Path, dst: Path) -> None:
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(src, dst)


def build_platform_frontend() -> None:
    """Build the platform portal frontend and copy dist to static/home/."""
    build_frontend(PLATFORM_FRONTEND_DIR, "/")
    copy_static(PLATFORM_FRONTEND_DIR / "dist", APP_DIR / "static" / "home")


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
    copy_shared_libs()
    remove_legacy_backend_aliases()
    copy_backend_packages()

    print("-> building CQ frontend (base=/cq/)")
    build_frontend(CQ_DIR / "frontend", "/cq/")
    copy_static(CQ_DIR / "frontend" / "dist", APP_DIR / "static" / "cq")
    print("-> CQ static ready")

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
