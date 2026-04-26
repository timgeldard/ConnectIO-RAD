#!/usr/bin/env python3
"""Validate monorepo consolidation contracts."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
WATCH_TEST_COMMANDS = ("vitest", "jest --watch", "npm test")


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def command_for(target: dict[str, Any]) -> str:
    options = target.get("options", {})
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
    target: dict[str, Any],
) -> None:
    command = command_for(target)
    if "npm run test:ci" not in command:
        errors.append(f"{project['name']}: frontend test target must run `npm run test:ci`, got `{command}`")
    if any(command.strip() == watch for watch in WATCH_TEST_COMMANDS):
        errors.append(f"{project['name']}: frontend test target may run in watch mode: `{command}`")

    package_path = package_json_for(project_file, target)
    if package_path is None:
        errors.append(f"{project['name']}: frontend test target has no package.json near its cwd")
        return
    scripts = load_json(package_path).get("scripts", {})
    if "test:ci" not in scripts:
        errors.append(f"{project['name']}: {package_path.relative_to(ROOT)} must define scripts.test:ci")


def validate_python_test(errors: list[str], project: dict[str, Any], target: dict[str, Any]) -> None:
    command = command_for(target)
    if "uv run --no-sync" not in command:
        errors.append(f"{project['name']}: Python test target must use `uv run --no-sync`, got `{command}`")
    if "python -m pytest" not in command:
        errors.append(f"{project['name']}: Python test target must use `python -m pytest`, got `{command}`")


def validate_project(project_file: Path, errors: list[str]) -> None:
    project = load_json(project_file)
    name = str(project.get("name", project_file.parent.name))
    project["name"] = name
    tags = set(project.get("tags", []))
    targets = project.get("targets", {})
    test_target = targets.get("test")

    if "type:frontend" in tags:
        for required in ("build", "test"):
            if required not in targets:
                errors.append(f"{name}: frontend project must define `{required}` target")
        if test_target:
            validate_frontend_test(errors, project_file, project, test_target)
        return

    is_python_project = "type:backend" in tags or (project_file.parent / "pyproject.toml").exists()
    if is_python_project and test_target:
        validate_python_test(errors, project, test_target)


def main() -> int:
    errors: list[str] = []
    for project_file in project_files():
        validate_project(project_file, errors)

    if errors:
        print("Repo contract validation failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print("Repo contract validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
