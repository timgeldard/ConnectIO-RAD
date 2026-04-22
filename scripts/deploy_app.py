#!/usr/bin/env python3
"""Shared Databricks Apps deploy wrapper.

The wrapper preserves trace2's successful deploy sequence while letting each app
describe its app-specific defaults and hooks in deploy.toml.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
import tomllib
from pathlib import Path
from string import Template
from typing import Any


ROOT = Path(__file__).resolve().parents[1]


def load_manifest(path: Path) -> dict[str, Any]:
    with path.open("rb") as handle:
        return tomllib.load(handle)


def app_path(args: argparse.Namespace) -> Path:
    return args.app_dir.resolve()


def manifest_path(args: argparse.Namespace) -> Path:
    return args.manifest.resolve() if args.manifest else app_path(args) / "deploy.toml"


def command_env(manifest: dict[str, Any]) -> dict[str, str]:
    env = os.environ.copy()
    for name, default in manifest.get("env", {}).items():
        env[name] = os.environ.get(name, str(default))
    env.setdefault("MSYS_NO_PATHCONV", "1")
    env.setdefault("MSYS2_ARG_CONV_EXCL", "*")
    return env


def format_value(value: str, context: dict[str, str]) -> str:
    return value.format(**context)


def run_command(
    command: list[str] | str,
    *,
    cwd: Path,
    env: dict[str, str],
    dry_run: bool,
) -> None:
    if isinstance(command, str):
        printable = command
        shell = True
    else:
        printable = " ".join(command)
        shell = False
    print(f"-> {printable}")
    if dry_run:
        return
    subprocess.run(command, cwd=cwd, env=env, shell=shell, check=True)


def context(manifest: dict[str, Any], args: argparse.Namespace) -> dict[str, str]:
    app = manifest.get("app", {})
    profile = args.profile or app.get("default_profile", "uat")
    target = args.target or app.get("default_target", profile)
    app_name = args.app_name or app.get("name", app_path(args).name)
    bundle_name = args.bundle_name or app.get("bundle_name", app_name)
    return {
        "app_name": str(app_name),
        "bundle_name": str(bundle_name),
        "profile": str(profile),
        "target": str(target),
        "app_dir": str(app_path(args)),
    }


def check_env(manifest: dict[str, Any], args: argparse.Namespace, env: dict[str, str]) -> None:
    ctx = context(manifest, args)
    run_command(
        ["databricks", "current-user", "me", "--profile", ctx["profile"], "-o", "json"],
        cwd=app_path(args),
        env=env,
        dry_run=args.dry_run,
    )


def build_frontend(manifest: dict[str, Any], args: argparse.Namespace, env: dict[str, str]) -> None:
    build = manifest.get("build", {})
    command = build.get("command")
    if not command:
        print("-> no frontend build command configured")
        return
    cwd = app_path(args) / build.get("cwd", ".")
    run_command(str(command), cwd=cwd, env=env, dry_run=args.dry_run)


def render_config(manifest: dict[str, Any], args: argparse.Namespace, env: dict[str, str]) -> None:
    app = manifest.get("app", {})
    template_path = app_path(args) / app.get("template", "app.template.yaml")
    output_path = app_path(args) / app.get("config_output", "app.yaml")
    values = {name: env[name] for name in manifest.get("env", {})}
    rendered = Template(template_path.read_text(encoding="utf-8")).safe_substitute(values)
    print(f"-> render {template_path.name} -> {output_path.name}")
    if not args.dry_run:
        output_path.write_text(rendered, encoding="utf-8")
    for name in sorted(values):
        print(f"   {name}={values[name]}")


def bundle_deploy(manifest: dict[str, Any], args: argparse.Namespace, env: dict[str, str]) -> None:
    ctx = context(manifest, args)
    bundle = manifest.get("bundle", {})
    command = ["databricks", "bundle", "deploy", "--profile", ctx["profile"]]
    if bundle.get("include_target", False):
        command.extend(["--target", ctx["target"]])
    run_command(command, cwd=app_path(args), env=env, dry_run=args.dry_run)


def post_deploy(manifest: dict[str, Any], args: argparse.Namespace, env: dict[str, str]) -> None:
    post = manifest.get("post_deploy", {})
    if not post.get("enabled", False):
        print("-> no post-deploy app snapshot configured")
        return

    ctx = context(manifest, args)
    target_key = post.get("source_target", "profile")
    source_target = ctx["target"] if target_key == "target" else ctx["profile"]
    source_path = f"/Workspace/Shared/.bundle/{ctx['bundle_name']}/{source_target}/files"
    payload = json.dumps({"source_code_path": source_path, "mode": "SNAPSHOT"})

    run_command(
        ["databricks", "apps", "deploy", ctx["app_name"], "--profile", ctx["profile"], "--json", payload],
        cwd=app_path(args),
        env=env,
        dry_run=args.dry_run,
    )

    if post.get("repair_sql_scope", False):
        run_command(
            [
                "databricks",
                "apps",
                "update",
                ctx["app_name"],
                "--profile",
                ctx["profile"],
                "--json",
                '{"user_api_scopes": ["sql"]}',
            ],
            cwd=app_path(args),
            env=env,
            dry_run=args.dry_run,
        )


def run_sql_migrations(manifest: dict[str, Any], args: argparse.Namespace, env: dict[str, str]) -> None:
    migrations = manifest.get("migrations", [])
    if not migrations:
        print("-> no SQL migrations configured")
        return
    ctx = context(manifest, args)
    values = {name: env[name] for name in manifest.get("env", {})}
    for migration in migrations:
        name = migration["name"]
        sql_path = app_path(args) / migration["file"]
        warehouse_id = str(migration["warehouse_id"])
        statement = Template(sql_path.read_text(encoding="utf-8")).safe_substitute(values)
        payload = json.dumps({"warehouse_id": warehouse_id, "statement": statement, "wait_timeout": "30s"})
        print(f"-> apply migration {name} from {migration['file']}")
        if args.dry_run:
            continue
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False, encoding="utf-8") as handle:
            handle.write(payload)
            tmpfile = handle.name
        try:
            run_command(
                [
                    "databricks",
                    "api",
                    "post",
                    "/api/2.0/sql/statements",
                    "--profile",
                    ctx["profile"],
                    "--json",
                    f"@{tmpfile}",
                ],
                cwd=app_path(args),
                env=env,
                dry_run=False,
            )
        finally:
            Path(tmpfile).unlink(missing_ok=True)


def run_hook_commands(manifest: dict[str, Any], args: argparse.Namespace, env: dict[str, str]) -> None:
    commands = manifest.get("commands", {}).get("after_bundle", [])
    if not commands:
        print("-> no after-bundle hook commands configured")
        return
    ctx = context(manifest, args)
    for command in commands:
        run_command(format_value(str(command), ctx), cwd=app_path(args), env=env, dry_run=args.dry_run)


def print_plan(manifest: dict[str, Any], args: argparse.Namespace) -> None:
    ctx = context(manifest, args)
    print(f"app_dir: {app_path(args)}")
    print(f"app_name: {ctx['app_name']}")
    print(f"bundle_name: {ctx['bundle_name']}")
    print(f"profile: {ctx['profile']}")
    print(f"target: {ctx['target']}")
    print("sequence: check-env -> build -> render -> bundle-deploy -> post-deploy -> migrations -> after-bundle-hooks")


def deploy(manifest: dict[str, Any], args: argparse.Namespace, env: dict[str, str]) -> None:
    check_env(manifest, args, env)
    build_frontend(manifest, args, env)
    render_config(manifest, args, env)
    bundle_deploy(manifest, args, env)
    post_deploy(manifest, args, env)
    run_sql_migrations(manifest, args, env)
    run_hook_commands(manifest, args, env)


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Deploy a Databricks app from deploy.toml")
    parser.add_argument("--app-dir", type=Path, default=Path.cwd(), help="App directory containing deploy.toml")
    parser.add_argument("--manifest", type=Path, help="Optional manifest path")
    parser.add_argument("--profile", help="Databricks CLI profile")
    parser.add_argument("--target", help="Databricks bundle target")
    parser.add_argument("--app-name", help="Override app name")
    parser.add_argument("--bundle-name", help="Override bundle name")
    parser.add_argument("--dry-run", action="store_true", help="Print commands without running them")
    parser.add_argument(
        "--action",
        choices=["plan", "check-env", "build", "render", "bundle", "post-deploy", "migrations", "hooks", "deploy"],
        default="deploy",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    manifest = load_manifest(manifest_path(args))
    env = command_env(manifest)

    if args.action == "plan":
        print_plan(manifest, args)
    elif args.action == "check-env":
        check_env(manifest, args, env)
    elif args.action == "build":
        build_frontend(manifest, args, env)
    elif args.action == "render":
        render_config(manifest, args, env)
    elif args.action == "bundle":
        bundle_deploy(manifest, args, env)
    elif args.action == "post-deploy":
        post_deploy(manifest, args, env)
    elif args.action == "migrations":
        run_sql_migrations(manifest, args, env)
    elif args.action == "hooks":
        run_hook_commands(manifest, args, env)
    else:
        deploy(manifest, args, env)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
