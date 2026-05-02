#!/usr/bin/env python3
"""Platform build script.

Steps:
  1. Copy shared Python libs (shared_db, shared_api, shared_auth) into app root.
  2. Copy POH backend as poh_backend, rewriting all internal `backend.` import
     references to `poh_backend.` so both backends coexist in one process.
  3. Copy CQ backend as cq_backend (routers only — no renaming needed since
     CQ routers are pure stubs with no internal backend.* imports).
  4. Build CQ frontend with VITE_BASE_PATH=/cq/ and copy dist to static/cq/.
  5. Build POH frontend with VITE_BASE_PATH=/poh/ and copy dist to static/poh/.

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

SHARED_LIBS = ["shared-db", "shared-api", "shared-auth"]


def copy_shared_libs() -> None:
    for lib in SHARED_LIBS:
        package_name = lib.replace("-", "_")
        src = REPO_ROOT / "libs" / lib / "src" / package_name
        dst = APP_DIR / package_name
        if dst.exists():
            shutil.rmtree(dst)
        shutil.copytree(src, dst)
        print(f"-> copied {package_name}")


def copy_and_rename_poh_backend() -> None:
    """Copy POH backend as poh_backend, rewriting internal import references."""
    src = POH_DIR / "backend"
    dst = APP_DIR / "poh_backend"
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(
        src, dst,
        ignore=shutil.ignore_patterns("tests", "__pycache__", "*.pyc", "main.py"),
    )
    # Rewrite: `from backend.` → `from poh_backend.`  and  `import backend.` → `import poh_backend.`
    for py_file in dst.rglob("*.py"):
        text = py_file.read_text(encoding="utf-8")
        new_text = text.replace("from backend.", "from poh_backend.")
        new_text = new_text.replace("import backend.", "import poh_backend.")
        if new_text != text:
            py_file.write_text(new_text, encoding="utf-8")
    print("-> copied and renamed poh_backend")


def copy_cq_backend() -> None:
    """Copy CQ backend routers as cq_backend.

    CQ's top-level backend/ has no __init__.py (namespace package) and only
    routers/ subdirectory is needed. The platform main.py provides its own
    entry point so main.py is excluded.
    """
    src = CQ_DIR / "backend"
    dst = APP_DIR / "cq_backend"
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(
        src, dst,
        ignore=shutil.ignore_patterns("tests", "__pycache__", "*.pyc", "main.py"),
    )
    # Add __init__.py so cq_backend is a proper package
    (dst / "__init__.py").write_text('"""CQ backend — build artifact. Do not edit.\n"""\n')
    print("-> copied cq_backend")


def build_frontend(app_frontend_dir: Path, base_path: str) -> None:
    env = {**os.environ, "VITE_BASE_PATH": base_path}
    subprocess.run("npm run build", cwd=app_frontend_dir, shell=True, check=True, env=env)


def copy_static(src: Path, dst: Path) -> None:
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(src, dst)


if __name__ == "__main__":
    copy_shared_libs()
    copy_and_rename_poh_backend()
    copy_cq_backend()

    print("-> building CQ frontend (base=/cq/)")
    build_frontend(CQ_DIR / "frontend", "/cq/")
    copy_static(CQ_DIR / "frontend" / "dist", APP_DIR / "static" / "cq")
    print("-> CQ static ready")

    print("-> building POH frontend (base=/poh/)")
    build_frontend(POH_DIR / "frontend", "/poh/")
    copy_static(POH_DIR / "frontend" / "dist", APP_DIR / "static" / "poh")
    print("-> POH static ready")

    sys.exit(0)
