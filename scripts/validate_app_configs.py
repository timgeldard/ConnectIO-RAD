#!/usr/bin/env python3
"""Validate generated Databricks app.yaml files against deploy manifests."""

from __future__ import annotations

import argparse
import difflib
import sys
import tomllib
from pathlib import Path
from string import Template
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_APPS = (
    "connectedquality",
    "envmon",
    "platform",
    "processorderhistory",
    "spc",
    "trace2",
    "warehouse360",
)


def load_manifest(app_dir: Path) -> dict[str, Any]:
    with (app_dir / "deploy.toml").open("rb") as handle:
        return tomllib.load(handle)


def context(manifest: dict[str, Any], app_dir: Path) -> dict[str, str]:
    app = manifest.get("app", {})
    profile = str(app.get("default_profile", "uat"))
    target = str(app.get("default_target", profile))
    app_name = str(app.get("name", app_dir.name))
    bundle_name = str(app.get("bundle_name", app_name))
    return {
        "app_name": app_name,
        "bundle_name": bundle_name,
        "profile": profile,
        "target": target,
        "app_dir": str(app_dir),
    }


def scoped_config(manifest: dict[str, Any], scope: str, name: str) -> dict[str, Any]:
    value = manifest.get(scope, {}).get(name, {})
    return value if isinstance(value, dict) else {}


def render_env(manifest: dict[str, Any], ctx: dict[str, str]) -> dict[str, str]:
    values: dict[str, Any] = dict(manifest.get("env", {}))
    values.update(scoped_config(manifest, "profiles", ctx["profile"]).get("env", {}))
    values.update(scoped_config(manifest, "targets", ctx["target"]).get("env", {}))
    return {name: str(value) for name, value in values.items()}


def render_app_yaml(app_dir: Path) -> tuple[Path, str]:
    manifest = load_manifest(app_dir)
    app = manifest.get("app", {})
    template_path = app_dir / app.get("template", "app.template.yaml")
    output_path = app_dir / app.get("config_output", "app.yaml")
    template_text = template_path.read_text(encoding="utf-8")
    rendered = Template(template_text).substitute(render_env(manifest, context(manifest, app_dir)))
    return output_path, rendered


def validate_app(app_name: str) -> list[str]:
    app_dir = ROOT / "apps" / app_name
    output_path, expected = render_app_yaml(app_dir)
    if not output_path.exists():
        return []

    actual = output_path.read_text(encoding="utf-8")
    if actual == expected:
        return []

    diff = "\n".join(
        difflib.unified_diff(
            actual.splitlines(),
            expected.splitlines(),
            fromfile=str(output_path),
            tofile=f"{output_path} (rendered)",
            lineterm="",
        )
    )
    return [f"{output_path}: generated config drifted\n{diff}"]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("apps", nargs="*", default=DEFAULT_APPS, help="App names under apps/")
    args = parser.parse_args()

    errors: list[str] = []
    for app_name in args.apps:
        errors.extend(validate_app(app_name))

    if errors:
        print("\n\n".join(errors), file=sys.stderr)
        return 1

    print("All app.yaml files match their deploy.toml default render.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
