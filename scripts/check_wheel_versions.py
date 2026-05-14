#!/usr/bin/env python3
"""Verify wheel-bundled packages have a version bump when their source changes.

Background
----------
The platform shell installs each app backend and shared lib from a local wheel
produced by `apps/platform/scripts/build.py`. pip's same-name-same-version cache
will skip reinstalling a wheel whose filename hasn't changed, even if its
contents differ — we got bitten by this on the W360 schema fix on 2026-05-07.
This guard makes the gotcha impossible: any source change inside one of the
wheel-bundled package directories must be accompanied by a `pyproject.toml`
version bump for that package.

Usage
-----
    python scripts/check_wheel_versions.py --base=<base-ref> [--head=<head-ref>]

Exit code is 0 when all packages with source changes have bumped versions, and
1 otherwise (with a per-package failure line on stderr).
"""
from __future__ import annotations

import argparse
import subprocess
import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Packages installed into the platform at deploy time. Keep in sync with
# WHEEL_PACKAGES in apps/platform/scripts/build.py.
PACKAGES: list[str] = [
    "libs/shared-api",
    "libs/shared-auth",
    "libs/shared-db",
    "libs/shared-ddd",
    "libs/shared-manufacturing",
    "libs/shared-trace",
    "libs/shared-geo",
    "apps/connectedquality/backend",
    "apps/envmon/backend",
    "apps/processorderhistory/backend",
    "apps/spc/backend",
    "apps/trace2/backend",
    "apps/warehouse360/backend",
]


def _run(cmd: list[str]) -> str:
    """Run a git command from the repo root and return stdout as text."""
    return subprocess.check_output(cmd, cwd=ROOT, text=True)


def get_version_at(ref: str, package: str) -> str | None:
    """Return the package version recorded at the given git ref, or None.

    Args:
        ref: Git ref (commit, branch, tag).
        package: Package directory relative to the repo root.

    Returns:
        Version string from `<package>/pyproject.toml` at ``ref``, or None if
        the file did not exist at that ref or could not be parsed.
    """
    try:
        content = _run(["git", "show", f"{ref}:{package}/pyproject.toml"])
    except subprocess.CalledProcessError:
        return None
    try:
        return tomllib.loads(content).get("project", {}).get("version")
    except tomllib.TOMLDecodeError:
        return None


def package_has_source_changes(base: str, head: str, package: str) -> bool:
    """Return True if any wheel-content file under ``package`` changed.

    Excluded paths (none of which ship in the wheel built by hatchling and so
    don't need to invalidate the cache): everything under ``tests/``, plain
    docs (``*.md``, ``*.rst``), and the package's ``pyproject.toml`` itself
    (we examine its content via ``get_version_at`` instead).
    """
    diff = _run(
        ["git", "diff", "--name-only", f"{base}...{head}", "--", package]
    ).strip().splitlines()

    def is_wheel_content(path: str) -> bool:
        rel = path[len(package) :].lstrip("/")
        if rel.startswith("tests/") or "/tests/" in rel:
            return False
        if rel.endswith((".md", ".rst")):
            return False
        # Files at the package directory root that hatchling does not include
        # in the wheel build. `pyproject.toml` is checked separately for the
        # version-bump signal; the rest are dev-tooling configs that don't
        # ship to runtime.
        if rel in ("pyproject.toml", "project.json", ".coveragerc", "uv.lock"):
            return False
        return True

    return any(is_wheel_content(p) for p in diff)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--base",
        required=True,
        help="Git ref to compare against (typically origin/main or NX_BASE).",
    )
    parser.add_argument(
        "--head",
        default="HEAD",
        help="Git ref representing the proposed change. Defaults to HEAD.",
    )
    args = parser.parse_args(argv)

    failures: list[str] = []
    for package in PACKAGES:
        base_version = get_version_at(args.base, package)
        head_version = get_version_at(args.head, package)
        if base_version is None:
            # New package on this branch — version bump rule does not apply.
            continue
        if not package_has_source_changes(args.base, args.head, package):
            continue
        if head_version is None:
            # pyproject.toml was deleted or made unparsable at the head ref.
            # That breaks both the wheel build AND the version-bump signal,
            # so flag it explicitly rather than silently passing.
            failures.append(
                f"{package}: source changed AND {package}/pyproject.toml is "
                f"missing or unparsable at head — fix the manifest so a wheel "
                f"can still be built and version-bumped."
            )
            continue
        if base_version == head_version:
            failures.append(
                f"{package}: source changed but pyproject.toml still at "
                f"version {base_version} — bump it so pip will reinstall the "
                f"new wheel on deploy."
            )

    if failures:
        for line in failures:
            print(line, file=sys.stderr)
        return 1

    print(f"check_wheel_versions: ok ({len(PACKAGES)} packages checked)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
