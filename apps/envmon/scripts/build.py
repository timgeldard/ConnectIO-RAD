#!/usr/bin/env python3
"""Pre-bundle build: copy shared Python libs into app root then build the frontend.

Shared libs live in libs/ at the repo root. Databricks Apps runs from the bundle
root, so packages placed here are directly importable without pip installation.
This script is run by deploy_app.py (via deploy.toml [build]) before bundle deploy.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

APP_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = APP_DIR.parents[1]

SHARED_LIBS = ["shared-db", "shared-api", "shared-geo"]


def copy_shared_libs() -> None:
    for lib in SHARED_LIBS:
        package_name = lib.replace("-", "_")
        src = REPO_ROOT / "libs" / lib / "src" / package_name
        dst = APP_DIR / package_name
        if dst.exists():
            shutil.rmtree(dst)
        shutil.copytree(src, dst)
        print(f"-> copied {package_name} ({src} -> {dst})")


def build_frontend() -> None:
    subprocess.run(
        "npm run build",
        cwd=APP_DIR / "frontend",
        shell=True,
        check=True,
    )


if __name__ == "__main__":
    copy_shared_libs()
    build_frontend()
    sys.exit(0)
