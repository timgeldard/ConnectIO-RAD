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
DEFAULT_WORKSPACE_FILES_PATH = "/Workspace/Shared/.bundle/{bundle_name}/{source_target}/files"
SENSITIVE_ENV_FRAGMENTS = ("TOKEN", "SECRET", "PASSWORD", "KEY", "CLIENT_ID", "CLIENT_SECRET")


def load_manifest(path: Path) -> dict[str, Any]:
    with path.open("rb") as handle:
        return tomllib.load(handle)


def app_path(args: argparse.Namespace) -> Path:
    return args.app_dir.resolve()


def manifest_path(args: argparse.Namespace) -> Path:
    return args.manifest.resolve() if args.manifest else app_path(args) / "deploy.toml"


def scoped_config(manifest: dict[str, Any], scope: str, name: str) -> dict[str, Any]:
    value = manifest.get(scope, {}).get(name, {})
    return value if isinstance(value, dict) else {}


def environment_defaults(manifest: dict[str, Any], args: argparse.Namespace) -> dict[str, Any]:
    ctx = context(manifest, args)
    defaults: dict[str, Any] = dict(manifest.get("env", {}))
    defaults.update(scoped_config(manifest, "profiles", ctx["profile"]).get("env", {}))
    defaults.update(scoped_config(manifest, "targets", ctx["target"]).get("env", {}))
    return defaults


def allow_empty_render_variables(manifest: dict[str, Any], args: argparse.Namespace) -> set[str]:
    ctx = context(manifest, args)
    allowed = set(manifest.get("allow_empty_render_variables", []))
    allowed.update(scoped_config(manifest, "profiles", ctx["profile"]).get("allow_empty_render_variables", []))
    allowed.update(scoped_config(manifest, "targets", ctx["target"]).get("allow_empty_render_variables", []))
    return {str(name) for name in allowed}


def command_env(manifest: dict[str, Any], args: argparse.Namespace) -> dict[str, str]:
    env = os.environ.copy()
    for name, default in environment_defaults(manifest, args).items():
        env[name] = os.environ.get(name, str(default))
    env.setdefault("MSYS_NO_PATHCONV", "1")
    env.setdefault("MSYS2_ARG_CONV_EXCL", "*")
    return env


def format_value(value: str, context: dict[str, str]) -> str:
    return value.format(**context)


def display_env_value(name: str, value: str, *, print_env: bool) -> str:
    if print_env:
        return value
    if any(fragment in name.upper() for fragment in SENSITIVE_ENV_FRAGMENTS):
        return "***"
    return "<set>"


def template_variables(template_text: str) -> set[str]:
    names: set[str] = set()
    for match in Template.pattern.finditer(template_text):
        name = match.group("named") or match.group("braced")
        if name:
            names.add(name)
    return names


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
    template_text = template_path.read_text(encoding="utf-8")
    names = set(environment_defaults(manifest, args)) | template_variables(template_text)
    values = {name: env[name] for name in names if name in env}
    allowed_empty = allow_empty_render_variables(manifest, args)
    missing = sorted(name for name in names if name not in values or (values[name] == "" and name not in allowed_empty))
    if missing:
        raise ValueError(f"Missing required render variables for {template_path.name}: {', '.join(missing)}")
    rendered = Template(template_text).substitute(values)
    print(f"-> render {template_path.name} -> {output_path.name}")
    if not args.dry_run:
        output_path.write_text(rendered, encoding="utf-8")
    for name in sorted(values):
        print(f"   {name}={display_env_value(name, values[name], print_env=args.print_env)}")


def resolve_migration_warehouse_id(migration: dict[str, Any], env: dict[str, str]) -> str:
    name = migration["name"]
    raw_value = migration.get("warehouse_id")
    if raw_value is None or str(raw_value) == "":
        env_name = migration.get("warehouse_id_env")
        if not env_name:
            raise ValueError(f"Migration {name} must define warehouse_id or warehouse_id_env")
        raw_value = env.get(str(env_name))
    if raw_value is None or str(raw_value) == "":
        raise ValueError(f"Missing warehouse id for migration {name}")
    return str(raw_value)


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
    target_key = post.get("source_target", "target")
    if target_key not in {"target", "profile"}:
        raise ValueError("post_deploy.source_target must be 'target' or 'profile'")
    source_target = ctx["target"] if target_key == "target" else ctx["profile"]
    source_context = {**ctx, "source_target": source_target}
    source_path = format_value(str(post.get("workspace_files_path", DEFAULT_WORKSPACE_FILES_PATH)), source_context)
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
    values = {name: env[name] for name in environment_defaults(manifest, args)}
    for migration in migrations:
        name = migration["name"]
        sql_path = app_path(args) / migration["file"]
        warehouse_id = resolve_migration_warehouse_id(migration, env)
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


def validate_config(manifest: dict[str, Any], args: argparse.Namespace, env: dict[str, str]) -> None:
    original_dry_run = args.dry_run
    args.dry_run = True
    try:
        render_config(manifest, args, env)
    finally:
        args.dry_run = original_dry_run
    migrations = manifest.get("migrations", [])
    for migration in migrations:
        resolve_migration_warehouse_id(migration, env)
    post = manifest.get("post_deploy", {})
    if post.get("enabled", False):
        target_key = post.get("source_target", "target")
        if target_key not in {"target", "profile"}:
            raise ValueError("post_deploy.source_target must be 'target' or 'profile'")
        source_target = context(manifest, args)["target"] if target_key == "target" else context(manifest, args)["profile"]
        source_path = format_value(
            str(post.get("workspace_files_path", DEFAULT_WORKSPACE_FILES_PATH)),
            {**context(manifest, args), "source_target": source_target},
        )
        if not source_path.startswith("/Workspace/"):
            raise ValueError("post_deploy workspace_files_path must resolve to a /Workspace path")
    print("-> deploy manifest validation passed")


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
    parser.add_argument("--print-env", action="store_true", help="Print resolved render variables without masking")
    parser.add_argument(
        "--action",
        choices=[
            "plan",
            "check-env",
            "build",
            "render",
            "bundle",
            "post-deploy",
            "migrations",
            "hooks",
            "validate",
            "deploy",
        ],
        default="deploy",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    manifest = load_manifest(manifest_path(args))
    env = command_env(manifest, args)

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
    elif args.action == "validate":
        validate_config(manifest, args, env)
    else:
        deploy(manifest, args, env)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
