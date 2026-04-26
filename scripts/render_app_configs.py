#!/usr/bin/env python3
"""Render all Databricks app.yaml files from deploy manifests."""

from __future__ import annotations

import argparse
import sys
from argparse import Namespace
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts import deploy_app

DEFAULT_APPS = ("envmon", "spc", "trace2", "warehouse360")


def render_app(app_name: str, *, dry_run: bool, print_env: bool) -> None:
    app_dir = ROOT / "apps" / app_name
    args = Namespace(
        app_dir=app_dir,
        manifest=None,
        profile=None,
        target=None,
        app_name=None,
        bundle_name=None,
        dry_run=dry_run,
        print_env=print_env,
    )
    manifest = deploy_app.load_manifest(deploy_app.manifest_path(args))
    env = deploy_app.command_env(manifest, args)
    deploy_app.render_config(manifest, args, env)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("apps", nargs="*", default=DEFAULT_APPS, help="App names under apps/")
    parser.add_argument("--dry-run", action="store_true", help="Print render actions without writing files")
    parser.add_argument("--print-env", action="store_true", help="Print resolved values without masking")
    args = parser.parse_args()

    for app_name in args.apps:
        render_app(app_name, dry_run=args.dry_run, print_env=args.print_env)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
