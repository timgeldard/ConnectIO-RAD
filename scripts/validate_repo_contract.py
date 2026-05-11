#!/usr/bin/env python3
"""Validate monorepo consolidation contracts."""

from __future__ import annotations

import json
import re
import sys
import tomllib
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
WATCH_TEST_COMMANDS = ("vitest", "jest --watch", "npm test")
EXPECTED_BACKEND_PORTS = {
    "spc-backend": 8000,
    "envmon-backend": 8001,
    "trace2-backend": 8002,
    "processorderhistory-backend": 8003,
    "warehouse360-backend": 8004,
    "connectedquality-backend": 8005,
    "platform-backend": 8006,
}
PORT_PATTERN = re.compile(r"--port\s+(\d+)")
REQUIRED_PROD_ENV_KEYS = (
    "DATABRICKS_WAREHOUSE_ID",
    "DATABRICKS_WAREHOUSE_HTTP_PATH",
    "TRACE_CATALOG",
    "POH_CATALOG",
)
FORBIDDEN_PRODUCTION_PATTERNS = {
    '"gold_views_pending"': "Use a domain-specific unavailable reason instead of the legacy placeholder.",
    "Feature coming soon": "Production apps must render actionable empty/loading/error states.",
    "demo robustness": "Production endpoints must not preserve demo-only behavior.",
    "Good morning, Niamh": "Demo identities must not be baked into production UI.",
    "Sarah Keane": "Demo identities must not be baked into production UI.",
    "../data/mockData": "Production pages must use API-backed hooks, not bundled mock data.",
    "~/data/mockData": "Production pages must use API-backed hooks, not bundled mock data.",
    'useState("20582002")': "Material context must come from session, search, or deep link.",
    'useState("0008898869")': "Batch context must come from session, search, or deep link.",
}
PLACEHOLDER_SCAN_EXTENSIONS = {".py", ".ts", ".tsx", ".js", ".jsx"}
PLACEHOLDER_SCAN_EXCLUDED_PARTS = {
    "__tests__",
    "tests",
    "docs",
    "standalone",
    "coverage",
    "dist",
    "static",
    "node_modules",
    "__pycache__",
}
PRODUCTION_APP_DIRS = (
    "connectedquality",
    "envmon",
    "platform",
    "processorderhistory",
    "spc",
    "trace2",
    "warehouse360",
)


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


NX_DEFAULTS = load_json(ROOT / "nx.json").get("targetDefaults", {})


def command_for(target: dict[str, Any] | None, target_name: str | None = None) -> str:
    options = (target or {}).get("options", {})
    if not options and target_name:
        options = NX_DEFAULTS.get(target_name, {}).get("options", {})
    command = options.get("command", "")
    return str(command)


def project_files() -> list[Path]:
    ignored = {"node_modules", ".venv", "dist", "coverage"}
    return sorted(
        path
        for path in ROOT.rglob("project.json")
        if not ignored.intersection(path.relative_to(ROOT).parts)
    )


def package_json_for(project_file: Path, target: dict[str, Any]) -> Path | None:
    cwd = target.get("options", {}).get("cwd")
    if isinstance(cwd, str) and cwd and cwd != "{workspaceRoot}":
        package_path = ROOT / cwd / "package.json"
        return package_path if package_path.exists() else None
    package_path = project_file.parent / "package.json"
    return package_path if package_path.exists() else None


def validate_frontend_test(
    errors: list[str],
    project_file: Path,
    project: dict[str, Any],
    target: dict[str, Any] | None,
    targets: dict[str, Any],
) -> None:
    command = command_for(target, "test")
    if not command or "uv run" in command or "python -m pytest" in command:
        return

    if not any(cmd in command for cmd in ("npm run test:ci", "npm test -- --run")):
        errors.append(f"{project['name']}: frontend test target must run non-watch Vitest via `npm test -- --run` or `npm run test:ci`, got `{command}`")
    if any(command.strip() == watch for watch in WATCH_TEST_COMMANDS):
        errors.append(f"{project['name']}: frontend test target may run in watch mode: `{command}`")

    coverage_target = targets.get("test:coverage")
    coverage_command = command_for(coverage_target, "test:coverage")
    if not coverage_command:
        errors.append(f"{project['name']}: frontend project must define `test:coverage` target")
    else:
        if not any(cmd in coverage_command for cmd in ("npm run test:ci", "npm run test:coverage")):
            errors.append(f"{project['name']}: frontend test:coverage target must run `npm run test:ci` or `npm run test:coverage`, got `{coverage_command}`")

    package_path = package_json_for(project_file, target or {})
    if package_path is None:
        errors.append(f"{project['name']}: frontend test target has no package.json near its cwd")
        return
    scripts = load_json(package_path).get("scripts", {})
    if "test:ci" not in scripts:
        errors.append(f"{project['name']}: {package_path.relative_to(ROOT)} must define scripts.test:ci")


def validate_frontend_lint(
    errors: list[str],
    project_file: Path,
    project: dict[str, Any],
    target: dict[str, Any] | None,
) -> None:
    command = command_for(target, "lint")
    if not command or "uv run" in command or "ruff check" in command:
        return

    if "npm run lint" not in command:
        errors.append(f"{project['name']}: frontend lint target must run `npm run lint`, got `{command}`")

    package_path = package_json_for(project_file, target or {})
    if package_path is None:
        errors.append(f"{project['name']}: frontend lint target has no package.json near its cwd")
        return
    scripts = load_json(package_path).get("scripts", {})
    if "lint" not in scripts:
        errors.append(f"{project['name']}: {package_path.relative_to(ROOT)} must define scripts.lint")


def validate_warehouse_typecheck(errors: list[str], project: dict[str, Any], targets: dict[str, Any]) -> None:
    if project["name"] != "warehouse360-frontend":
        return

    typecheck_target = targets.get("typecheck")
    command = command_for(typecheck_target, "typecheck")
    if not command:
        errors.append("warehouse360-frontend: frontend project must define `typecheck` target")
        return

    if "npm run typecheck" not in command:
        errors.append(f"warehouse360-frontend: typecheck target must run `npm run typecheck`, got `{command}`")


def validate_python_test(errors: list[str], project: dict[str, Any], target: dict[str, Any] | None) -> None:
    command = command_for(target, "test")
    if not command:
        return
    if "uv run --no-sync" not in command:
        errors.append(f"{project['name']}: Python test target must use `uv run --no-sync`, got `{command}`")
    if "python -m pytest" not in command:
        errors.append(f"{project['name']}: Python test target must use `python -m pytest`, got `{command}`")


def validate_backend_serve_port(
    errors: list[str],
    project: dict[str, Any],
    serve_target: dict[str, Any] | None,
    seen_ports: dict[int, str],
) -> None:
    name = str(project["name"])
    expected_port = EXPECTED_BACKEND_PORTS.get(name)
    if expected_port is None:
        return

    command = command_for(serve_target, "serve")
    if not command:
        return

    match = PORT_PATTERN.search(command)
    if match is None:
        errors.append(f"{name}: backend serve target must declare `--port {expected_port}`, got `{command}`")
        return

    actual_port = int(match.group(1))
    if actual_port != expected_port:
        errors.append(f"{name}: backend serve target must use port {expected_port}, got {actual_port}")

    previous_project = seen_ports.get(actual_port)
    if previous_project is not None:
        errors.append(f"{name}: backend serve port {actual_port} collides with {previous_project}")
    seen_ports[actual_port] = name


def validate_project(project_file: Path, errors: list[str], seen_backend_ports: dict[int, str]) -> None:
    project = load_json(project_file)
    name = str(project.get("name", project_file.parent.name))
    project["name"] = name
    tags = set(project.get("tags", []))
    targets = project.get("targets", {})

    if "type:frontend" in tags:
        for required in ("build", "test", "lint"):
            if required not in targets:
                cmd = command_for(None, required)
                if "uv run" in cmd or "python" in cmd or "ruff" in cmd:
                    continue
                errors.append(f"{name}: frontend project must define `{required}` target")
        
        validate_frontend_test(errors, project_file, project, targets.get("test"), targets)
        validate_frontend_lint(errors, project_file, project, targets.get("lint"))
        validate_warehouse_typecheck(errors, project, targets)
        return

    is_python_project = "type:backend" in tags or (project_file.parent / "pyproject.toml").exists()
    if "type:backend" in tags:
        validate_backend_serve_port(errors, project, targets.get("serve"), seen_backend_ports)
    if is_python_project:
        validate_python_test(errors, project, targets.get("test"))


def deploy_manifest_files() -> list[Path]:
    return sorted((ROOT / "apps").glob("*/deploy.toml"))


def validate_bundle_smoke_contract(errors: list[str], deploy_file: Path, manifest: dict[str, Any]) -> None:
    app_dir = deploy_file.parent
    app = manifest.get("app", {})
    template = app_dir / str(app.get("template", "app.template.yaml"))
    databricks_bundle = app_dir / "databricks.yml"

    if not template.exists():
        errors.append(f"{app_dir.relative_to(ROOT)}: deployment bundle must include {template.name}")
    if not databricks_bundle.exists():
        errors.append(f"{app_dir.relative_to(ROOT)}: deployment bundle must include databricks.yml")

    bundle = manifest.get("bundle", {})
    if "include_target" not in bundle:
        errors.append(f"{app_dir.relative_to(ROOT)}: deploy.toml must declare bundle.include_target for bundle smoke checks")


def scoped_env(manifest: dict[str, Any], scope: str, name: str) -> dict[str, Any]:
    value = manifest.get(scope, {}).get(name, {})
    if not isinstance(value, dict):
        return {}
    env = value.get("env", {})
    return env if isinstance(env, dict) else {}


def validate_prod_manifest(errors: list[str], deploy_file: Path, manifest: dict[str, Any]) -> None:
    app_dir = deploy_file.parent
    app = manifest.get("app", {})
    prod_env = scoped_env(manifest, "targets", "prod") or scoped_env(manifest, "profiles", "prod")
    if not prod_env:
        errors.append(f"{app_dir.relative_to(ROOT)}: deploy.toml must define prod env under targets.prod.env or profiles.prod.env")
        return

    for key in REQUIRED_PROD_ENV_KEYS:
        if key in prod_env and str(prod_env[key]).strip() == "":
            errors.append(f"{app_dir.relative_to(ROOT)}: prod env `{key}` must not be empty")

    default_target = str(app.get("default_target", app.get("default_profile", "")))
    if default_target == "prod":
        errors.append(f"{app_dir.relative_to(ROOT)}: default deployment target must not be prod")


def validate_deploy_manifests(errors: list[str]) -> None:
    for deploy_file in deploy_manifest_files():
        with deploy_file.open("rb") as handle:
            manifest = tomllib.load(handle)
        validate_bundle_smoke_contract(errors, deploy_file, manifest)
        validate_prod_manifest(errors, deploy_file, manifest)


def should_scan_placeholder_file(path: Path) -> bool:
    relative = path.relative_to(ROOT)
    if path.suffix not in PLACEHOLDER_SCAN_EXTENSIONS:
        return False
    return not PLACEHOLDER_SCAN_EXCLUDED_PARTS.intersection(relative.parts)


def validate_forbidden_placeholders(errors: list[str]) -> None:
    for app_name in PRODUCTION_APP_DIRS:
        app_dir = ROOT / "apps" / app_name
        if not app_dir.exists():
            continue
        for path in sorted(app_dir.rglob("*")):
            if not path.is_file() or not should_scan_placeholder_file(path):
                continue
            text = path.read_text(encoding="utf-8", errors="ignore")
            for pattern, message in FORBIDDEN_PRODUCTION_PATTERNS.items():
                if pattern in text:
                    errors.append(f"{path.relative_to(ROOT)}: forbidden placeholder `{pattern}`. {message}")


def main() -> int:
    errors: list[str] = []
    seen_backend_ports: dict[int, str] = {}
    for project_file in project_files():
        validate_project(project_file, errors, seen_backend_ports)
    validate_deploy_manifests(errors)
    validate_forbidden_placeholders(errors)

    if errors:
        print("Repo contract validation failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print("Repo contract validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
