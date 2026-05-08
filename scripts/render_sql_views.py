#!/usr/bin/env python3
"""Render SQL view templates for a target environment.

Reads ``deploy.toml`` for the given app and target, substitutes ``${VAR}``
placeholders in SQL files under ``sql/views/``, and writes the rendered files
to ``sql/views/rendered/<target>/``.  Follows the same pattern as
``validate_app_configs.py``.

Usage::

    python3 scripts/render_sql_views.py warehouse360 --target uat
    python3 scripts/render_sql_views.py warehouse360 --target prod
"""

from __future__ import annotations

import argparse
import sys
import tomllib
from pathlib import Path
from string import Template


ROOT = Path(__file__).resolve().parents[1]


def load_env(app_name: str, target: str) -> dict[str, str]:
    """Return the merged environment variables for *app_name* / *target*."""
    deploy_toml = ROOT / "apps" / app_name / "deploy.toml"
    with deploy_toml.open("rb") as fh:
        manifest = tomllib.load(fh)

    values: dict[str, str] = {}
    values.update({k: str(v) for k, v in manifest.get("env", {}).items()})
    target_env = manifest.get("targets", {}).get(target, {}).get("env", {})
    values.update({k: str(v) for k, v in target_env.items()})
    return values


def render_views(app_name: str, target: str) -> int:
    """Render all .sql files for *app_name* to ``rendered/<target>/``."""
    views_dir = ROOT / "apps" / app_name / "sql" / "views"
    if not views_dir.is_dir():
        print(f"No sql/views directory for {app_name!r}; skipping.", file=sys.stderr)
        return 0

    out_dir = views_dir / "rendered" / target
    out_dir.mkdir(parents=True, exist_ok=True)

    env = load_env(app_name, target)
    errors: list[str] = []
    rendered_count = 0

    for sql_file in sorted(views_dir.glob("*.sql")):
        text = sql_file.read_text(encoding="utf-8")
        try:
            rendered = Template(text).substitute(env)
        except KeyError as exc:
            errors.append(f"{sql_file.name}: missing variable {exc}")
            continue
        out_path = out_dir / sql_file.name
        out_path.write_text(rendered, encoding="utf-8")
        rendered_count += 1
        print(f"  rendered: {sql_file.name} -> {out_path.relative_to(ROOT)}")

    if errors:
        for err in errors:
            print(f"ERROR: {err}", file=sys.stderr)
        return 1

    print(f"Rendered {rendered_count} SQL file(s) to {out_dir.relative_to(ROOT)}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("app", help="App name under apps/ (e.g. warehouse360)")
    parser.add_argument("--target", default="uat", help="Deploy target (default: uat)")
    args = parser.parse_args()
    return render_views(args.app, args.target)


if __name__ == "__main__":
    raise SystemExit(main())
